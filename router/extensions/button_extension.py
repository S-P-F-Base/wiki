import re
import xml.etree.ElementTree as etree

from markdown.extensions import Extension
from markdown.treeprocessors import Treeprocessor


class ButtonTreeProcessor(Treeprocessor):
    RE = re.compile(r"!btn\[(.*?)\|(.*?)\]")

    def run(self, root: etree.Element):
        for elem in list(root):
            if elem.text:
                chunks = []
                last = 0
                for match in self.RE.finditer(elem.text):
                    prefix_text = elem.text[last : match.start()]
                    if prefix_text.strip():
                        span = etree.Element("span")
                        span.text = prefix_text
                        chunks.append(span)

                    a = etree.Element("a", href=match.group(1).strip())
                    a.text = match.group(2).strip()
                    chunks.append(a)

                    last = match.end()

                if chunks:
                    tail_text = elem.text[last:]
                    if tail_text.strip():
                        span = etree.Element("span")
                        span.text = tail_text
                        chunks.append(span)

                    nav = etree.Element("nav", {"class": "links-list"})
                    for ch in chunks:
                        nav.append(ch)

                    elem.clear()
                    elem.tag = nav.tag
                    elem.attrib = nav.attrib
                    elem.extend(nav)

                    elem.tail = None


class ButtonExtension(Extension):
    def extendMarkdown(self, md):
        md.treeprocessors.register(ButtonTreeProcessor(md), "button_processor", 220)
