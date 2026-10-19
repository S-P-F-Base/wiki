import re
from xml.etree import ElementTree as etree

from markdown.extensions import Extension

from template_env import static_url

from .blocks import BRACKET_END_RE, Block, DirectiveBlockProcessor


class ButtonExtension(Extension):
    def extendMarkdown(self, md):
        md.parser.blockprocessors.register(
            ButtonBlockProcessor(md.parser),
            "wiki_button",
            170,
        )


class ButtonBlockProcessor(DirectiveBlockProcessor):
    START_RE = re.compile(r"^\s*!button\[\s*$")
    END_RE = BRACKET_END_RE

    def render(self, parent, block: Block):
        data = block.arguments

        if len(data) < 2:
            return

        url = data[0]
        name = data[1]
        desc = None
        image = None

        if len(data) >= 3:
            if (
                data[2]
                .lower()
                .endswith((".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"))
            ):
                image = data[2]

            else:
                desc = data[2]

        if len(data) >= 4:
            image = data[3]

        a = etree.SubElement(parent, "a")
        a.set("class", "wiki-button")
        a.set("href", url)

        if image:
            icon = etree.SubElement(a, "span")
            icon.set("class", "wiki-button-icon")

            img = etree.SubElement(icon, "img")
            img.set("src", static_url(image))
            img.set("alt", "")
            img.set("loading", "lazy")
            img.set("decoding", "async")

        meta = etree.SubElement(a, "span")
        meta.set("class", "wiki-button-meta")

        title = etree.SubElement(meta, "span")
        title.set("class", "wiki-button-title")
        title.text = name

        if desc:
            d = etree.SubElement(meta, "span")
            d.set("class", "wiki-button-desc")
            d.text = desc
