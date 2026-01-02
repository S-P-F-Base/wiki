import re
from xml.etree import ElementTree as etree

from markdown.blockprocessors import BlockProcessor
from markdown.extensions import Extension

from template_env import static_url


class ImgBlockProcessor(BlockProcessor):
    RE = re.compile(
        r"^\s*!imgblock\[(.+?)\|\s*(left|right|middle)(?:\|\s*([^\]]+))?\]\s*$",
        re.IGNORECASE,
    )

    def __init__(self, parser, resolver):
        super().__init__(parser)
        self.resolver = resolver

    def parse_size(self, size_str: str):
        parts = [p.strip().lower() for p in size_str.split(",")]
        width = parts[0] if len(parts) > 0 else "40%"
        height = parts[1] if len(parts) > 1 else None
        mode = parts[2] if len(parts) > 2 else "max"

        def valid(value: str):
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

    def test(self, parent, block: str) -> bool:
        first_line = block.split("\n", 1)[0]
        return bool(self.RE.match(first_line))

    def run(self, parent, blocks):
        raw = blocks.pop(0)
        lines = raw.splitlines()

        match = self.RE.match(lines[0])
        if not match:
            return

        raw_path = match.group(1).strip()
        pos = match.group(2).lower()
        size_raw = match.group(3)

        if size_raw:
            width, height, mode = self.parse_size(size_raw)

        else:
            width, height, mode = "40%", None, "max"

        if ".." in raw_path:
            url = ""

        else:
            rel_path = f"images/{raw_path.lstrip('/')}"
            url = self.resolver(rel_path)

        content_lines: list[str] = []
        for line in lines[1:]:
            if line.strip().lower() == "!endimgblock":
                break

            content_lines.append(line)

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

        self.parser.parseBlocks(content_div, content_lines)


class ImgBlockExtension(Extension):
    def extendMarkdown(self, md):
        md.parser.blockprocessors.register(
            ImgBlockProcessor(md.parser, static_url),
            "imgblock",
            100,
        )
