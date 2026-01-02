import re

from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor


class StrikethroughPreprocessor(Preprocessor):
    RE = re.compile(r"~~(.*?)~~")

    def run(self, lines):
        new_lines = []
        for line in lines:
            line = self.RE.sub(r"<del>\1</del>", line)
            new_lines.append(line)
        return new_lines


class StrikethroughExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(StrikethroughPreprocessor(md), "strikethrough", 25)
