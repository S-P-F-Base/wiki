import re
from xml.etree import ElementTree as etree

from markdown.blockprocessors import BlockProcessor
from markdown.extensions import Extension

from template_env import static_url


class ImgBlockProcessor(BlockProcessor):
    RE = re.compile(
        r"^\s*!img\[\s*(?P<url>[^\|\]]+)"
        r"(?:\|\s*(?P<pos>left|right|middle))?"
        r"(?:\|\s*(?P<size>[^\]]+))?\s*\]\s*$",
        re.IGNORECASE,
    )

    def __init__(self, parser, resolver):
        super().__init__(parser)
        self.resolver = resolver

    def parse_size(self, size_str: str):
        parts = [p.strip().lower() for p in size_str.split(",")]
        width = parts[0] if len(parts) > 0 else "100%"
        height = parts[1] if len(parts) > 1 else None
        mode = parts[2] if len(parts) > 2 else "max"

        def valid(value: str):
            return (
                re.match(r"^\d+%$", value)
                or re.match(r"^\d+px$", value)
                or value == "auto"
            )

        if not valid(width):
            width = "100%"

        if height and not valid(height):
            height = None

        if mode not in {"max", "hard"}:
            mode = "max"

        return width, height, mode

    def test(self, parent, block: str) -> bool:
        return bool(self.RE.match(block.strip()))

    def run(self, parent, blocks):
        raw = blocks.pop(0).strip()
        match = self.RE.match(raw)
        if not match:
            return

        raw_path = match.group("url").strip()
        pos = (match.group("pos") or "middle").lower()
        size_raw = match.group("size")

        if size_raw:
            width, height, mode = self.parse_size(size_raw)

        else:
            width, height, mode = "100%", None, "max"

        if ".." in raw_path:
            url = ""

        else:
            rel_path = f"images/{raw_path.lstrip('/')}"
            url = self.resolver(rel_path)

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


class ImgExtension(Extension):
    def extendMarkdown(self, md):
        md.parser.blockprocessors.register(
            ImgBlockProcessor(md.parser, static_url),
            "imgsingle",
            100,
        )
