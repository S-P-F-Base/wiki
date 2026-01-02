import hashlib
import re

from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor
from markdown.treeprocessors import Treeprocessor


def slugify(text: str) -> str:
    base = re.sub(r"[^\w\- ]+", "", text).strip().lower().replace(" ", "-")
    if not base:
        base = hashlib.md5(text.encode("utf-8")).hexdigest()[:8]
    return base


class HeaderAnchorTreeprocessor(Treeprocessor):
    def run(self, root):
        for elem in root.iter():
            if elem.tag in {f"h{i}" for i in range(1, 7)}:
                text = "".join(elem.itertext()).strip()
                anchor = slugify(text)
                elem.set("id", anchor)


class TocTreePreprocessor(Preprocessor):
    RE_TOC = re.compile(r"^\s*\[TOC\]\s*$", re.IGNORECASE)
    RE_HEADER = re.compile(r"^(#{1,6})\s+(.*)")

    def run(self, lines: list[str]) -> list[str]:
        headers: list[tuple[int, str, str]] = []
        in_code_block = False
        code_block_delim = None

        for line in lines:
            m_code = re.match(r"^(```)", line)
            if m_code:
                delim = m_code.group(1)
                if not in_code_block:
                    in_code_block = True
                    code_block_delim = delim
                elif code_block_delim and line.startswith(code_block_delim):
                    in_code_block = False
                    code_block_delim = None
                continue

            if in_code_block:
                continue

            m = self.RE_HEADER.match(line)
            if m:
                level = len(m.group(1))
                text = m.group(2).strip()
                anchor = slugify(text)
                headers.append((level, text, anchor))

        def build_tree(nodes):
            root: list[dict] = []
            stack = [(0, root)]
            for level, text, anchor in nodes:
                node = {"text": text, "anchor": anchor, "children": []}
                while stack and level <= stack[-1][0]:
                    stack.pop()
                stack[-1][1].append(node)
                stack.append((level, node["children"]))
            return root

        def render_ascii(nodes, prefix=""):
            out: list[str] = []
            for idx, node in enumerate(nodes):
                last = idx == len(nodes) - 1
                connector = "└── " if last else "├── "
                line = (
                    f'{prefix}{connector}<a href="#{node["anchor"]}">{node["text"]}</a>'
                )
                out.append(line)
                ext = "    " if last else "│   "
                out.extend(render_ascii(node["children"], prefix + ext))
            return out

        tree = build_tree(headers)
        tree_lines = render_ascii(tree)

        new_lines: list[str] = []
        for line in lines:
            if self.RE_TOC.match(line):
                new_lines.append('<div class="foldertree">')
                new_lines.append('<div class="toc-title">Оглавление</div>')
                new_lines.append("<pre>")
                new_lines.extend(tree_lines)
                new_lines.append("</pre>")
                new_lines.append("</div>")
            else:
                new_lines.append(line)

        return new_lines


class TocTreeExtension(Extension):
    def extendMarkdown(self, md):
        md.treeprocessors.register(HeaderAnchorTreeprocessor(md), "header_anchor", 15)
        md.preprocessors.register(TocTreePreprocessor(md), "toc_tree", 27)
        md.registerExtension(self)
