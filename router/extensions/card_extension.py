import re
from xml.etree import ElementTree as etree

from markdown.extensions import Extension

from .blocks import Block, DirectiveBlockProcessor


class CardExtension(Extension):
    def extendMarkdown(self, md):
        md.parser.blockprocessors.register(
            CardBlockProcessor(md.parser),
            "card_block",
            175,
        )


class CardBlockProcessor(DirectiveBlockProcessor):
    START_RE = re.compile(r"^\s*!card(?:\[(?P<color>[^\]]+)\])?\s*$")
    END_RE = re.compile(r"^\s*!card_end\s*$")

    def render(self, parent, block: Block):
        section = etree.SubElement(parent, "section")
        section.set("class", "card")
        color = block.match.group("color")
        if color:
            section.set("style", f"--card-accent:{color};")

        self.parse_content(section, block.body)
