import re

from markdown.extensions import Extension

from .blocks import SHORT_HEADER_END_RE, Block, DirectivePreprocessor, parse_options


class RestrictedExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(
            RestrictedPreprocessor(md),
            "restricted_block",
            23,
        )


class RestrictedPreprocessor(DirectivePreprocessor):
    START_RE = re.compile(r"^!restricted\[$")
    HEADER_END_RE = SHORT_HEADER_END_RE
    END_RE = re.compile(r"!restricted_end")

    def render(self, block: Block):
        attrs = parse_options("\n".join(block.header))
        body_lines = block.body

        title = attrs.get("title", "")
        tag = attrs.get("tag", "RESTRICTED")
        state = attrs.get("state", "BLOCKED")

        text = "<br>".join(line.rstrip() for line in body_lines if line.strip())

        html = [
            '<div class="restricted">',
            '<div class="header">',
            f'<span class="tag">{tag}</span>',
            f'<span class="state">{state}</span>',
            "</div>",
            '<div class="body">',
        ]

        if title:
            html.append(f'<p class="title">{title}</p>')

        if text:
            html.append(f'<p class="text">{text}</p>')

        html.extend(
            [
                "</div>",
                "</div>",
            ]
        )

        return "".join(html)
