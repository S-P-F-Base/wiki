import re

from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor


class SmallTextPreprocessor(Preprocessor):
    RE = re.compile(r"^\s*-\#\s+(.*)$")

    def run(self, lines):
        result = []
        for line in lines:
            m = self.RE.match(line)
            if m:
                result.append(f'<div class="small">{m.group(1).strip()}</div>')
            else:
                result.append(line)
        return result


class SmallTextExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(SmallTextPreprocessor(md), "smalltext", 25)
