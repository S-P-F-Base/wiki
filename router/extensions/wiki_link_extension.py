import urllib.parse
import xml.etree.ElementTree as etree

from markdown.extensions import Extension
from markdown.inlinepatterns import InlineProcessor


class WikiLinkProcessor(InlineProcessor):
    RE = r"\[\[([^\|\]]+)\|([^\]]+)\]\]"

    def handleMatch(self, m, data):
        path = m.group(1).strip()
        text = m.group(2).strip()
        url = urllib.parse.quote(path)

        el = etree.Element("a")
        el.set("href", url)
        el.text = text
        return el, m.start(0), m.end(0)


class WikiLinkExtension(Extension):
    def extendMarkdown(self, md):
        md.inlinePatterns.register(
            WikiLinkProcessor(WikiLinkProcessor.RE, md), "wikilink", 160
        )
