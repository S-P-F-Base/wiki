import re

from markdown import Markdown
from markdown.extensions import Extension
from markdown.postprocessors import Postprocessor

from template_env import static_url


class ImgUrlPostprocessor(Postprocessor):
    def __init__(self, resolver):
        self.resolver = resolver

    def run(self, text: str) -> str:
        def replace(m):
            raw = m.group(1).strip()

            if ".." in raw:
                return "<invalid img path>"

            path = f"images/{raw.lstrip('/')}"
            return self.resolver(path)

        pattern = re.compile(r"(?<!\\)!img_url\[(.+?)\]")
        text = pattern.sub(replace, text)

        return text.replace(r"\!img_url", "!img_url")


class ImgUrlExtension(Extension):
    def extendMarkdown(self, md: Markdown):
        md.postprocessors.register(
            ImgUrlPostprocessor(static_url),
            "img_url_postprocessor",
            10,
        )
