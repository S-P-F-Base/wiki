import re
from typing import Any

from markdown.extensions import Extension

from .blocks import SHORT_HEADER_END_RE, Block, DirectivePreprocessor, parse_attributes


class RegistryExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(RegistryPreprocessor(md), "registry_block", 24)


class RegistryPreprocessor(DirectivePreprocessor):
    START_RE = re.compile(r"^\s*!registry\[\s*$")
    END_RE = re.compile(r"^\s*!registry_end\s*$")
    HEADER_END_RE = SHORT_HEADER_END_RE
    ALLOW_UNCLOSED_BODY = False

    SECTION_RE = re.compile(r"^(.+?):\s*$")
    VARIANT_RE = re.compile(r"^-\s*([^:]+):\s*(.+)$")

    def parse_body(self, body_lines: list[str]) -> list[dict[str, Any]]:
        sections: list[dict[str, Any]] = []
        current: dict[str, Any] | None = None

        for raw in body_lines:
            line = raw.rstrip()
            if not line.strip():
                continue

            m = self.SECTION_RE.match(line)
            if m:
                current = {
                    "title": m.group(1).strip(),
                    "text": [],
                    "variants": [],
                }
                sections.append(current)
                continue

            if current:
                m = self.VARIANT_RE.match(line)
                if m:
                    current["variants"].append(
                        {
                            "key": m.group(1).strip(),
                            "value": m.group(2).strip(),
                        }
                    )
                else:
                    current["text"].append(line)

        return sections

    def render(self, block: Block):
        attrs = parse_attributes(block.header)
        sections = self.parse_body(block.body)

        name = attrs.get("name", "")
        desc = attrs.get("desc", "")

        html = [
            '<div class="registry-entry">',
            '<div class="registry-head">',
            f'<div class="registry-name">{name}</div>',
            f'<div class="registry-desc">{desc}</div>',
            "</div>",
        ]

        if sections:
            html.append('<div class="registry-body">')

            for sec in sections:
                html.append(f'<div class="registry-label">{sec["title"]}</div>')

                if sec["variants"]:
                    html.append('<div class="registry-variants">')
                    for v in sec["variants"]:
                        html.append(
                            '<div class="variant">'
                            f'<div class="variant-key">{v["key"]}</div>'
                            f"<div>{v['value']}</div>"
                            "</div>"
                        )
                    html.append("</div>")
                else:
                    text = "<br>".join(sec["text"])
                    html.append(f'<div class="registry-text">{text}</div>')

            html.append("</div>")

        html.append("</div>")

        return "".join(html)
