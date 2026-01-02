from __future__ import annotations

import re
import shlex
import xml.etree.ElementTree as etree
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from markdown import Extension, Markdown
from markdown.treeprocessors import Treeprocessor

RU_MONTHS = {
    "января": 1,
    "февраля": 2,
    "марта": 3,
    "апреля": 4,
    "мая": 5,
    "июня": 6,
    "июля": 7,
    "августа": 8,
    "сентября": 9,
    "октября": 10,
    "ноября": 11,
    "декабря": 12,
}


class _Args:
    def __init__(self, raw: str):
        self.kw: Dict[str, Any] = {}
        if not raw:
            return
        lex = shlex.shlex(raw, posix=True)
        lex.whitespace_split = True
        lex.whitespace = ","
        for tok in lex:
            if "=" not in tok:
                continue
            k, v = tok.split("=", 1)
            k = k.strip()
            v = v.strip()
            if len(v) >= 2 and v[0] == v[-1] and v[0] in ("'", '"'):
                v = v[1:-1]
            vl = v.lower()
            if vl in ("true", "false"):
                self.kw[k] = vl == "true"
            else:
                try:
                    self.kw[k] = int(v)
                except ValueError:
                    self.kw[k] = v

    def get(self, key: str, default: Any) -> Any:
        return self.kw.get(key, default)


class AutoLinkButtonsTreeprocessor(Treeprocessor):
    RE = re.compile(r"^\s*!auto_link_btn(?:\((?P<args>[^)]*)\))?\s*$")

    def __init__(self, md, wiki_dir: Path):
        super().__init__(md)
        self.wiki_dir = Path(wiki_dir).resolve()

    def run(self, root: etree.Element):
        for elem in list(root):
            txt = (elem.text or "").strip()
            m = self.RE.match(txt)
            if not m:
                continue

            args = _Args(m.group("args") or "")
            sort_mode = str(args.get("sort", "alpha")).lower()
            exclude = [
                x.strip().lower()
                for x in str(args.get("exclude", "")).split(",")
                if x.strip()
            ]
            limit = int(args.get("limit", 0))

            current_file: Optional[str] = getattr(self.md, "current_file", None)
            if not current_file:
                elem.clear()
                elem.tag = "div"
                elem.set("class", "links-list")
                continue

            current_path = Path(current_file).resolve()
            folder = current_path.parent

            items = self._collect(folder, exclude, current_path)
            items = self._sort(items, sort_mode)
            if limit and limit > 0:
                items = items[:limit]

            nav = etree.Element("nav", {"class": "links-list"})
            for it in items:
                a = etree.Element("a", {"href": it["href"]})
                a.text = it["title"]
                nav.append(a)

            elem.clear()
            elem.tag = nav.tag
            elem.attrib = nav.attrib
            elem.extend(list(nav))

    def _collect(
        self, folder: Path, exclude: List[str], current_path: Path
    ) -> List[Dict[str, str]]:
        out: List[Dict[str, str]] = []

        for md_file in sorted(folder.glob("*.md")):
            if md_file.resolve() == current_path:
                continue

            name_no_ext = md_file.stem.lower()
            if name_no_ext in exclude:
                continue

            meta = self._read_meta(md_file)
            title = meta.get("title") or md_file.stem
            date = self._parse_date(meta.get("date"), md_file.stat().st_mtime)
            href = self._href_from(md_file)
            out.append({"title": title, "href": href, "date": date.isoformat()})

        for subdir in sorted(folder.iterdir()):
            if not subdir.is_dir():
                continue

            index_file = subdir / "index.md"
            if not index_file.exists():
                continue

            name_no_ext = subdir.name.lower()
            if name_no_ext in exclude:
                continue

            meta = self._read_meta(index_file)
            title = meta.get("title") or subdir.name
            date = self._parse_date(meta.get("date"), index_file.stat().st_mtime)
            href = self._href_from(index_file)
            out.append({"title": title, "href": href, "date": date.isoformat()})

        return out

    def _href_from(self, md_path: Path) -> str:
        rel = md_path.resolve().relative_to(self.wiki_dir).with_suffix("")
        return "/wiki/" + str(rel).replace("\\", "/")

    def _read_meta(self, md_path: Path) -> Dict[str, str]:
        try:
            text = md_path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return {}

        head = []
        for line in text.splitlines():
            if not line.strip():
                break

            head.append(line)
        head_text = "\n".join(head)

        md = Markdown(extensions=["meta"])
        md.convert(head_text)

        meta = {}
        for k, v in getattr(md, "Meta", {}).items():
            if isinstance(v, list):
                meta[k.lower()] = v[0]
            else:
                meta[k.lower()] = str(v)

        return meta

    def _parse_date(self, raw: Optional[str], fallback_ts: float) -> datetime:
        if not raw:
            return datetime.fromtimestamp(fallback_ts)

        raw = raw.strip()
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d.%m.%Y"):
            try:
                return datetime.strptime(raw, fmt)

            except ValueError:
                pass

        parts = raw.split()
        if len(parts) >= 3:
            try:
                day = int(parts[0])
                month = RU_MONTHS[parts[1].lower()]
                year = int(parts[2])
                return datetime(year, month, day)

            except Exception:
                pass

        return datetime.fromtimestamp(fallback_ts)

    def _sort(self, items: List[Dict[str, str]], mode: str) -> List[Dict[str, str]]:
        if mode == "date":
            return sorted(items, key=lambda x: x["date"], reverse=True)

        return sorted(items, key=lambda x: x["title"].lower())


class AutoLinkButtonsExtension(Extension):
    def __init__(self, **kwargs):
        self.config = {
            "wiki_dir": [Path("wiki"), "Root of wiki directory"],
        }
        super().__init__(**kwargs)

    def extendMarkdown(self, md):
        md.treeprocessors.register(
            AutoLinkButtonsTreeprocessor(md, Path(self.getConfig("wiki_dir"))),
            "auto_link_buttons",
            225,
        )
