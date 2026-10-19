import re

from markdown.extensions import Extension

from template_env import static_url

from .blocks import BRACKET_END_RE, Block, DirectivePreprocessor, parse_options


class DialogExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(
            DialogPreprocessor(md),
            "dialog_block",
            25,
        )


class DialogPreprocessor(DirectivePreprocessor):
    START_RE = re.compile(r"^!dialog_start\[$")
    HEADER_END_RE = BRACKET_END_RE
    END_RE = re.compile(r"!dialog_end")

    PARTICIPANT_RE = re.compile(
        r"""
        ^\s*
        (?P<key>[^:]+)
        :
        \s*
        (?P<side>left|right|center)
        (?P<opts>.*)
        $
        """,
        re.VERBOSE,
    )

    LINE_RE = re.compile(r"^\s*([^:]+):\s*(.+)$")
    UPDATE_RE = re.compile(r"^\s*@(\w+)\s+(.*)$")

    def render(self, block: Block):
        participants = self.parse_participants("\n".join(block.header))
        dialog_lines = self.parse_lines(block.body)

        html = ['<div class="dialog">']

        for item in dialog_lines:
            kind = item["type"]

            if kind == "update":
                self.apply_update(participants, item)
                continue

            if kind == "system":
                html.append(self.render_system_line(item["text"]))
                continue

            p = participants.get(item["key"])
            if not p:
                html.append(self.render_system_line(item["text"]))
                continue

            html.append(
                self.render_line(
                    side=p["side"],
                    name=p.get("name"),
                    text=item["text"],
                    avatar=p.get("avatar"),
                )
            )

        html.append("</div>")
        return "".join(html)

    def parse_participants(self, header):
        participants = {}

        for raw in header.splitlines():
            raw = raw.strip()
            if not raw:
                continue

            m = self.PARTICIPANT_RE.match(raw)
            if not m:
                continue

            key = m.group("key").strip()
            side = m.group("side")
            opts_raw = m.group("opts") or ""

            opts = parse_options(opts_raw)

            participants[key] = {
                "side": side,
                **opts,
            }

        return participants

    def parse_lines(self, lines):
        result = []

        for line in lines:
            raw = line.strip()
            if not raw:
                continue

            m = self.UPDATE_RE.match(raw)
            if m:
                opts = parse_options(m.group(2))

                result.append(
                    {
                        "type": "update",
                        "key": m.group(1),
                        "opts": opts,
                    }
                )
                continue

            m = self.LINE_RE.match(raw)
            if m:
                result.append(
                    {
                        "type": "line",
                        "key": m.group(1).strip(),
                        "text": m.group(2).strip(),
                    }
                )
                continue

            result.append(
                {
                    "type": "system",
                    "text": raw,
                }
            )

        return result

    def apply_update(self, participants, item):
        p = participants.get(item["key"])
        if not p:
            return

        for k, v in item["opts"].items():
            p[k] = v

    def render_line(self, side, text, name=None, avatar=None):
        parts = [f'<div class="dialog-line {side}">']

        if avatar and side != "center":
            parts.append(
                f'<div class="dialog-avatar"><img loading="lazy" decoding="async" src="{static_url(avatar)}"></div>'
            )

        parts.append('<div class="dialog-bubble">')

        if name:
            parts.append(f'<div class="dialog-name">{name}</div>')

        parts.append(f'<div class="dialog-text">{text}</div>')
        parts.append("</div></div>")

        return "".join(parts)

    def render_system_line(self, text):
        return (
            '<div class="dialog-line center">'
            '<div class="dialog-bubble system">'
            f'<div class="dialog-text">{text}</div>'
            "</div></div>"
        )
