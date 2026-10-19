import re
from xml.etree.ElementTree import SubElement

from markdown.blockprocessors import BlockProcessor
from markdown.extensions import Extension


class SmallTextExtension(Extension):
    def extendMarkdown(self, md):
        md.parser.blockprocessors.register(
            SmallTextBlockProcessor(md.parser), "small_text", 85
        )


class SmallTextBlockProcessor(BlockProcessor):
    RE = re.compile(r"^\s*-#\s*(.*)$", re.MULTILINE)

    def test(self, parent, block):
        return self.RE.search(block) is not None

    def run(self, parent, blocks):
        source = blocks[0]
        match = self.RE.search(source)
        if match is None:
            return False
        blocks.pop(0)
        before, after = source[: match.start()], source[match.end() :]
        if before.strip():
            self.parser.parseBlocks(parent, [before])
        element = SubElement(parent, "div", {"class": "small-text"})
        element.text = match[1]
        if after.strip():
            blocks.insert(0, after.lstrip("\n"))
