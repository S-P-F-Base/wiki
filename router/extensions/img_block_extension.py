import re
from xml.etree import ElementTree as etree

from markdown.blockprocessors import BlockProcessor
from markdown.extensions import Extension


class ImgBlockProcessor(BlockProcessor):
    RE = re.compile(
        r"^!imgblock\[(.+?)\|\s*(left|right|middle)\s*(?:\|\s*([^\]]+))?\]\s*$",
        re.IGNORECASE,
    )

    def parse_size(self, size_str):
        parts = [p.strip().lower() for p in size_str.split(",")]
        width = parts[0] if len(parts) > 0 else "40%"
        height = parts[1] if len(parts) > 1 else None
        mode = parts[2] if len(parts) > 2 else "max"

        def valid(value):
            return (
                re.match(r"^\d+%$", value)
                or re.match(r"^\d+px$", value)
                or value == "auto"
            )

        if not valid(width):
            width = "40%"

        if height and not valid(height):
            height = None

        if mode not in {"max", "hard"}:
            mode = "max"

        return width, height, mode

    def test(self, parent, block):
        return bool(self.RE.match(block.split("\n", 1)[0]))

    def run(self, parent, blocks):
        raw = blocks.pop(0)
        lines = raw.splitlines()

        match = self.RE.match(lines[0])
        if not match:
            return

        url = match.group(1).strip()
        pos = match.group(2).strip().lower()
        size_raw = match.group(3)

        if size_raw:
            width, height, mode = self.parse_size(size_raw)
        else:
            width, height, mode = "40%", None, "max"

        content_lines = []
        for line in lines[1:]:
            if line.strip().lower() == "!endimgblock":
                break
            content_lines.append(line)

        content = "\n".join(content_lines).strip()

        wrapper = etree.SubElement(parent, "div")
        wrapper.set("class", f"img-side {pos}")

        img = etree.SubElement(wrapper, "img")
        img.set("src", url)
        img.set("alt", "")

        if mode == "hard":
            style = f"width:{width};"
            if height:
                style += f" height:{height};"
        else:
            style = f"max-width:{width};"
            if height:
                style += f" max-height:{height};"

        img.set("style", style)

        content_div = etree.SubElement(wrapper, "div")
        content_div.set("class", "content")
        content_div.text = content


class ImgBlockExtension(Extension):
    def extendMarkdown(self, md):
        md.parser.blockprocessors.register(
            ImgBlockProcessor(md.parser), "imgblock", 100
        )
