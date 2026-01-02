import re

from markdown import Markdown
from markdown.extensions import Extension
from markdown.postprocessors import Postprocessor


class ConstPostprocessor(Postprocessor):
    def __init__(self, constants):
        self.constants = constants

    def run(self, text):
        def replace_const(m):
            key = m.group(1).strip()
            return self.constants.get(key, f"<missing const: {key}>")

        pattern = re.compile(r"(?<!\\)!const\[(.+?)\]")
        text = pattern.sub(replace_const, text)

        text = text.replace(r"\!const", "!const")
        return text


class ConstExtension(Extension):
    def __init__(self, **kwargs):
        self.config = {
            "constants": [{}, "Dictionary of constants"],
        }
        super().__init__(**kwargs)

    def extendMarkdown(self, md: Markdown):
        constants = self.getConfig("constants")
        md.postprocessors.register(
            ConstPostprocessor(constants), "const_postprocessor", 10
        )
