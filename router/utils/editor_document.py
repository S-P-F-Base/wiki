"""Lossless source blocks and annotated rendering for the local visual editor."""

import html
import re
from threading import Lock
from typing import Any, Literal
from uuid import uuid4
from xml.etree.ElementTree import Element, SubElement

from markdown.treeprocessors import Treeprocessor
from pydantic import BaseModel, Field

from config import Constants

from ..extensions.blocks import parse_attributes
from ..extensions.button_extension import ButtonBlockProcessor
from ..extensions.card_extension import CardBlockProcessor
from ..extensions.dialog_extension import DialogPreprocessor
from ..extensions.folder_tree_extension import FolderTreePreprocessor
from ..extensions.grid_extension import GridBlockProcessor
from ..extensions.image_extension import ImageBlockProcessor
from ..extensions.registry_extension import RegistryPreprocessor
from ..extensions.restricted_extension import RestrictedPreprocessor
from .editor_directives import read_directive, write_directive
from .editor_text_blocks import read_list, read_table, write_text_block
from .markdown_engine import (
    AI_ART_DESP,
    AI_TEXT_DESP,
    _create_markdown_eng,
    get_ai_description,
)

FENCE_RE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
HEADING_RE = re.compile(r"^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$")
COMPLEX_RE = re.compile(
    r"^(?:\s{4}|\t|\s*>|\s*-#|\s*[-+*]\s|\s*\d+[.)]\s|\s*\||\s*[-=_*]{3,}\s*$)"
)
DYNAMIC_RE = re.compile(r"!(?!(?:constant|redact)\[)\w|!\[|<(?!/?(?:small|br)\b)[^>]+>")
INLINE_TOKEN_RE = re.compile(r"(?<!\\)!(constant|redact)\[([^]]+)\]")
FOOTNOTE_RE = re.compile(r"^\[\^([^]\s]+)\]:[ \t]*(.*)")
RULE_RE = re.compile(r"^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$")
PROTECTED = (
    DialogPreprocessor,
    RegistryPreprocessor,
    RestrictedPreprocessor,
    FolderTreePreprocessor,
    ButtonBlockProcessor,
)
MARKER = "WIKIEDITORBLOCK_"


def new_id():
    return uuid4().hex


def annotate_inline_tokens(text):
    counter = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal counter
        kind, value = match[1], match[2]
        shown = (
            Constants.get_all_const().get(value, "Неизвестная константа: " + value)
            if kind == "constant"
            else "".join("█" if not char.isspace() else char for char in value)
        )
        token = (
            f'<span class="editor-inline-token" contenteditable="false" data-token-missing="{str(kind == "constant" and value not in Constants.get_all_const()).lower()}" data-token-index="{counter}" '
            f'data-token-kind="{kind}" data-token-value="{html.escape(value, quote=True)}">{html.escape(shown)}</span>'
        )
        counter += 1
        return token

    return INLINE_TOKEN_RE.sub(replace, text)


class EditorBlock(BaseModel):
    id: str = Field(default_factory=new_id)
    kind: Literal[
        "raw",
        "card",
        "grid",
        "cell",
        "text",
        "heading",
        "image",
        "toc",
        "rule",
        "footnote",
        "template",
        "directive",
        "table",
        "list",
    ]
    raw: str = ""
    opening: str = ""
    closing: str = ""
    children: list["EditorBlock"] = Field(default_factory=list)
    markdown: str | None = None
    color: str = ""
    level: int = Field(default=1, ge=1, le=6)
    path: str = ""
    attrs: dict[str, str] = Field(default_factory=dict)
    changed: bool = False
    label: str = ""
    note_text: str = ""
    columns: int = Field(default=3, ge=1, le=100)
    step: int = Field(default=1, ge=1, le=10000)
    directive_type: str = ""
    props: dict[str, Any] = Field(default_factory=dict)


def block(kind, **values):
    return EditorBlock(id=uuid4().hex, kind=kind, **values)


def grid_cells(children):
    result = []
    cell = block("cell")
    for child in children:
        match = (
            GridBlockProcessor.STEP_RE.fullmatch(child.raw.strip())
            if child.kind == "raw"
            else None
        )
        if match:
            distance = int(match.group("step") or 1)
            if any(
                item.kind != "raw"
                or re.sub(r"<!--.*?-->", "", item.raw, flags=re.DOTALL).strip()
                for item in cell.children
            ):
                result.append(cell)
                cell = block("cell", opening=child.raw, step=distance)
            else:
                cell.opening += "".join(item.raw for item in cell.children) + child.raw
                cell.children = []
                cell.step = sum(
                    int(step.group("step") or 1)
                    for line in cell.opening.splitlines()
                    if (step := GridBlockProcessor.STEP_RE.fullmatch(line))
                )
        else:
            cell.children.append(child)
    result.append(cell)
    return result


def closing_line(lines, start, directive):
    depth = 0
    fence = None
    for index in range(start + 1, len(lines)):
        stripped = lines[index].strip()
        match = FENCE_RE.match(lines[index])
        if match:
            token = match[1]
            if fence is None:
                fence = token
            elif token[0] == fence[0] and len(token) >= len(fence):
                fence = None
            continue
        if fence:
            continue
        if directive.START_RE.match(stripped):
            depth += 1
        elif directive.END_RE.match(stripped):
            if depth:
                depth -= 1
            else:
                return index
    return None


def parse_blocks(source: str) -> list[EditorBlock]:
    lines = source.splitlines(keepends=True)
    result = []
    index = 0
    while index < len(lines):
        line = lines[index]
        stripped = line.strip()
        if not stripped:
            end = index + 1
            while end < len(lines) and not lines[end].strip():
                end += 1
            result.append(block("raw", raw="".join(lines[index:end])))
            index = end
            continue
        fence = FENCE_RE.match(line)
        if fence:
            end = index + 1
            while end < len(lines):
                close = FENCE_RE.match(lines[end])
                end += 1
                if (
                    close
                    and close[1][0] == fence[1][0]
                    and len(close[1]) >= len(fence[1])
                ):
                    break
            result.append(block("raw", raw="".join(lines[index:end])))
            index = end
            continue
        if stripped.startswith("<!--"):
            end = index + 1
            while "-->" not in "".join(lines[index:end]) and end < len(lines):
                end += 1
            result.append(block("raw", raw="".join(lines[index:end])))
            index = end
            continue
        handled = False
        for kind, directive in [
            ("card", CardBlockProcessor),
            ("grid", GridBlockProcessor),
        ]:
            match = directive.START_RE.match(stripped)
            if match:
                end = closing_line(lines, index, directive)
                if end is not None:
                    values = (
                        {"color": match.group("color") or ""} if kind == "card" else {}
                    )
                    children = parse_blocks("".join(lines[index + 1 : end]))
                    if kind == "grid":
                        values["columns"] = int(match.group("cols") or 3)
                        children = grid_cells(children)
                    result.append(
                        block(
                            kind,
                            opening=line,
                            closing=lines[end],
                            children=children,
                            **values,
                        )
                    )
                    index = end + 1
                    handled = True
                break
        if handled:
            continue
        structured = read_table(lines, index)
        kind = "table"
        if structured is None:
            structured = read_list(lines, index)
            kind = "list"
        if structured is not None:
            end, props = structured
            if props.pop("unsupported", False):
                kind, props = "raw", {}
            result.append(block(kind, raw="".join(lines[index:end]), props=props))
            index = end
            continue
        caption = re.fullmatch(r"\s*-#\s*(.*)", line.rstrip("\r\n"))
        if caption:
            result.append(
                block(
                    "directive",
                    raw=line,
                    directive_type="caption",
                    props={"text": html.unescape(caption[1])},
                )
            )
            index += 1
            continue
        template = re.fullmatch(r"!template\[([^]]+)\]", stripped)
        if template:
            result.append(block("template", raw=line, path=template[1].strip()))
            index += 1
            continue
        auto = re.fullmatch(r"!auto_buttons(?:\[([^]]+)\])?", stripped)
        if auto or stripped == "!image_float_break":
            result.append(
                block(
                    "directive",
                    raw=line,
                    directive_type="auto_buttons" if auto else "float_break",
                    props={"sort": (auto[1] or "abc") if auto else ""},
                )
            )
            index += 1
            continue
        if stripped.upper() == "[TOC]":
            result.append(block("toc", raw=line))
            index += 1
            continue
        if RULE_RE.fullmatch(line.rstrip("\r\n")):
            result.append(block("rule", raw=line))
            index += 1
            continue
        note = FOOTNOTE_RE.match(line)
        if note:
            end = index + 1
            while end < len(lines):
                if lines[end].startswith(("    ", "\t")) or (
                    not lines[end].strip()
                    and end + 1 < len(lines)
                    and lines[end + 1].startswith(("    ", "\t"))
                ):
                    end += 1
                else:
                    break
            body = note[2].rstrip("\r\n")
            for continuation in lines[index + 1 : end]:
                body += "\n" + re.sub(r"^(?: {4}|\t)", "", continuation).rstrip("\r\n")
            result.append(
                block(
                    "footnote",
                    raw="".join(lines[index:end]),
                    label=note[1],
                    note_text=body,
                )
            )
            index = end
            continue
        image_end = ImageBlockProcessor.END_RE
        if image_end is not None and ImageBlockProcessor.START_RE.match(stripped):
            end = index + 1
            while end < len(lines) and not image_end.match(lines[end].strip()):
                end += 1
            if end < len(lines):
                args = [item.strip() for item in lines[index + 1 : end] if item.strip()]
                if args:
                    result.append(
                        block(
                            "image",
                            raw="".join(lines[index : end + 1]),
                            path=args[0],
                            attrs=parse_attributes(args[1:], unquote_values=False),
                        )
                    )
                    index = end + 1
                    continue
        for directive in PROTECTED:
            if not directive.START_RE.match(stripped):
                continue
            end = index + 1
            header_end = getattr(directive, "HEADER_END_RE", None)
            short = False
            if header_end is not None:
                while end < len(lines) and not header_end.match(lines[end].strip()):
                    end += 1
                if end < len(lines):
                    short = bool(
                        header_end.match(lines[end].strip()).groupdict().get("escaped")
                    )
                    end += 1
            if not short:
                close = end
                end_re = directive.END_RE
                while close < len(lines) and (
                    end_re is None or not end_re.match(lines[close].strip())
                ):
                    close += 1
                if close < len(lines):
                    end = close + 1
                elif getattr(directive, "ALLOW_UNCLOSED_BODY", True):
                    end = len(lines)
            raw = "".join(lines[index:end])
            name, props = read_directive(raw)
            result.append(block("directive", raw=raw, directive_type=name, props=props))
            index = end
            handled = True
            break
        if handled:
            continue
        if GridBlockProcessor.STEP_RE.match(stripped):
            result.append(block("raw", raw=line))
            index += 1
            continue
        heading = HEADING_RE.match(line.rstrip("\r\n"))
        if heading and not DYNAMIC_RE.search(line):
            result.append(block("heading", raw=line, level=len(heading[1])))
            index += 1
            continue
        end = index + 1
        while end < len(lines) and lines[end].strip():
            if (
                lines[end].lstrip().startswith("!")
                or HEADING_RE.match(lines[end])
                or FENCE_RE.match(lines[end])
                or lines[end].lstrip().startswith("-#")
            ):
                break
            end += 1
        raw = "".join(lines[index:end])
        protected = (
            (stripped.startswith("!") and not INLINE_TOKEN_RE.match(stripped))
            or stripped.startswith("[TOC]")
            or re.match(r"^\s*\[[^]]+\]:", stripped)
            or DYNAMIC_RE.search(raw)
            or any(COMPLEX_RE.match(item) for item in lines[index:end])
        )
        result.append(block("raw" if protected else "text", raw=raw))
        index = end
    return result


def serialize_blocks(nodes: list[EditorBlock], annotate: bool = False) -> str:
    parts = []
    for node in nodes:
        marker = (
            f"\n\n{MARKER}{node.id}\n\n"
            if annotate and node.kind not in {"raw", "toc", "footnote"}
            else ""
        )
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", str(node.id)):
            raise ValueError("Некорректный идентификатор блока")
        if node.kind == "cell":
            opening = node.opening
            match = (
                GridBlockProcessor.STEP_RE.fullmatch(opening.strip())
                if opening
                else None
            )
            if match and int(match.group("step") or 1) != node.step:
                opening = "\n\n!grid_step[" + str(node.step) + "]\n\n"
            cell_marker = f"\n\n{MARKER}{node.id}:cell\n\n" if annotate else ""
            parts.append(
                opening + cell_marker + serialize_blocks(node.children, annotate)
            )
        elif node.kind in ("card", "grid"):
            opening = node.opening
            if node.kind == "grid":
                original_grid = (
                    GridBlockProcessor.START_RE.fullmatch(opening.strip())
                    if opening
                    else None
                )
                if (
                    original_grid is None
                    or int(original_grid.group("cols") or 3) != node.columns
                ):
                    opening = (
                        ("\n\n" if not original_grid else "")
                        + "!grid["
                        + str(node.columns)
                        + "]\n"
                    )
            if node.kind == "card":
                if (
                    any(char in node.color for char in "\r\n[];{}")
                    or len(node.color) > 100
                ):
                    raise ValueError("Некорректный цвет карточки")
                original = (
                    CardBlockProcessor.START_RE.match(opening.strip())
                    if opening
                    else None
                )
                if original is None or (original.group("color") or "") != node.color:
                    ending = "\r\n" if opening.endswith("\r\n") else "\n"
                    opening = (
                        ("" if original else "\n\n")
                        + "!card"
                        + ("[" + node.color + "]" if node.color else "")
                        + ending
                    )
            if not opening:
                raise ValueError("Не указан тип контейнера")
            content = serialize_blocks(node.children, annotate)
            if not node.opening and node.kind == "card":
                content = "\n" + content.strip("\r\n") + "\n\n"
                closing = "!card_end\n\n"
            else:
                closing = node.closing
            parts.append(marker + opening + content + closing)
        elif node.kind in ("text", "heading"):
            if node.markdown is None:
                text = node.raw
            else:
                text = node.markdown.strip("\r\n")
                if annotate and not text.strip():
                    text = "\u200b"
                if node.kind == "heading":
                    text = "#" * node.level + " " + text.replace("\n", " ")
                if node.raw:
                    ending = (
                        "\r\n"
                        if node.raw.endswith("\r\n")
                        else "\n"
                        if node.raw.endswith("\n")
                        else ""
                    )
                    text += ending
                else:
                    text = "\n\n" + text + "\n\n"
            parts.append(marker + (annotate_inline_tokens(text) if annotate else text))
        elif node.kind in {"table", "list"}:
            text = (
                node.raw
                if node.raw and not node.changed
                else write_text_block(node.kind, node.props)
            )
            parts.append(marker + (annotate_inline_tokens(text) if annotate else text))
        elif node.kind == "image":
            if not node.changed and node.raw:
                text = node.raw
            else:
                if any(char in node.path for char in "\r\n") or any(
                    "\n" in value or "\r" in value for value in node.attrs.values()
                ):
                    raise ValueError("Некорректные параметры изображения")
                text = "\n\n!image[\n    " + node.path + "\n"
                for key, value in node.attrs.items():
                    if not re.fullmatch(r"\w+", key):
                        raise ValueError("Некорректное свойство изображения")
                    text += "    " + key + "=" + value + "\n"
                text += "]\n\n"
            parts.append(marker + text)
        elif node.kind in {"template", "directive"}:
            if node.kind == "template":
                if any(char in node.path for char in "\r\n[]"):
                    raise ValueError("Некорректное имя шаблона")
                text = (
                    node.raw
                    if node.raw and not node.changed
                    else "\n\n!template[" + node.path + "]\n\n"
                )
                label = "Шаблон: " + node.path
            else:
                text = (
                    node.raw
                    if node.raw and not node.changed
                    else write_directive(node.directive_type, node.props)
                )
                label = {
                    "dialog": "Диалог",
                    "registry": "Реестр",
                    "restricted": "Ограниченный доступ",
                    "folder": "Дерево файлов",
                    "button": "Кнопка",
                    "auto_buttons": "Список страниц",
                    "float_break": "Разрыв",
                    "caption": "Мелкий текст",
                }.get(node.directive_type, node.directive_type)
                if annotate and node.directive_type == "caption":
                    text = annotate_inline_tokens(text)
            if annotate:
                parts.append(
                    f"\n\n{MARKER}{node.id}:wrapper:{label}\n\n"
                    + text
                    + f"\n\nWIKIEDITORSTOP_{node.id}\n\n"
                )
            else:
                parts.append(text)
        elif node.kind == "toc":
            parts.append(node.raw or "\n\n[TOC]\n\n")
        elif node.kind == "rule":
            parts.append(marker + (node.raw or "\n\n---\n\n"))
        elif node.kind == "footnote":
            if not re.fullmatch(r"[^\s\[\]:]+", node.label):
                raise ValueError("Некорректный номер сноски")
            if node.markdown is None and node.raw:
                parts.append(node.raw)
            else:
                text = node.markdown if node.markdown is not None else node.note_text
                text = text.replace("\r\n", "\n").replace("\n", "\n    ")
                parts.append(f"\n\n[^{node.label}]: {text}\n\n")
        else:
            parts.append(node.raw)
    return "".join(parts)


class EditorMarkers(Treeprocessor):
    def run(self, root):
        for parent in list(root.iter()):
            pending = None
            wrapper = None
            children = []
            for child in list(parent):
                text = (child.text or "").strip()
                if child.tag == "p" and text.startswith(MARKER) and not len(child):
                    values = text[len(MARKER) :].split(":", 2)
                    if len(values) > 1 and values[1] == "cell":
                        parent.set("data-editor-id", values[0])
                    elif len(values) > 1 and values[1] == "wrapper":
                        wrapper = Element(
                            "section",
                            {
                                "class": "editor-managed-block",
                                "data-editor-id": values[0],
                            },
                        )
                        badge = SubElement(
                            wrapper,
                            "div",
                            {"class": "editor-block-label", "contenteditable": "false"},
                        )
                        badge.text = values[2]
                        children.append(wrapper)
                    else:
                        pending = values[0]
                    continue
                if (
                    child.tag == "p"
                    and text.startswith("WIKIEDITORSTOP_")
                    and not len(child)
                ):
                    wrapper = None
                    continue
                if pending is not None:
                    child.set("data-editor-id", pending)
                    pending = None
                if wrapper is not None:
                    wrapper.append(child)
                else:
                    children.append(child)
            parent[:] = children


_EDITOR_ENGINE = _create_markdown_eng()
_EDITOR_ENGINE.treeprocessors.register(
    EditorMarkers(_EDITOR_ENGINE), "editor_markers", 25
)
_EDITOR_LOCK = Lock()


def render_document(path, source, dictionary_paths=None):
    with _EDITOR_LOCK:
        md = _EDITOR_ENGINE
        md.reset()
        setattr(md, "current_file", path)  # noqa: B010
        originals = []
        if dictionary_paths:
            for processor_name, attribute, value in [
                ("autolink", "autolinks_path", dictionary_paths[0]),
                ("link_preview", "previews_path", dictionary_paths[1]),
            ]:
                processor = md.treeprocessors[processor_name]
                originals.append((processor, attribute, getattr(processor, attribute)))
                setattr(processor, attribute, value)
        try:
            html = md.convert(source)
            meta = getattr(md, "wiki_meta", {}).copy()
        finally:
            md.reset()
            md.parser.state.clear()
            setattr(md, "current_file", None)  # noqa: B010
            for processor, attribute, value in originals:
                setattr(processor, attribute, value)
    author = meta.get("author")
    return (
        html,
        meta.get("title", "Страница"),
        meta.get("date"),
        [name.strip() for name in author.split(",")] if author else None,
        meta.get("background"),
        get_ai_description(meta, "AIText", AI_TEXT_DESP),
        get_ai_description(meta, "AIArt", AI_ART_DESP),
    )
