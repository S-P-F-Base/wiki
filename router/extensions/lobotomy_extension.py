import re

from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor


class LobotomyPreprocessor(Preprocessor):
    RE_START = re.compile(r"^!lob\[\s*$")
    RE_END = re.compile(r"^\s*\]\s*$")

    def run(self, lines):
        new_lines = []
        i = 0

        while i < len(lines):
            if self.RE_START.match(lines[i]):
                i += 1
                params = {}
                while i < len(lines) and not self.RE_END.match(lines[i]):
                    line = lines[i].rstrip()
                    if line and ":" in line:
                        key, val = map(str.strip, line.split(":", 1))
                        i += 1
                        extra = []
                        while i < len(lines) and (
                            lines[i].startswith(" ") or not lines[i].strip()
                        ):
                            extra.append(lines[i].lstrip())
                            i += 1
                        val = "\n".join([val] + extra)
                        params[key.lower()] = val
                        continue
                    i += 1
                i += 1

                style = params.get("style", "base")
                if style.lower() == "base":
                    style = ""

                msg = params.get(
                    "msg", "ИНФОРМАЦИЯ ЗАБЛОКИРОВАНА\nНЕОБХОДИМЫЕ УРОВНИ ДОСТУПА:"
                )
                arr = params.get("arr", "GV,CMR,OPR")

                html = f'''
<div class="corp-lobotomy" data-display="block" data-style="{style}"
     data-msg="{msg}"
     data-arr="{arr}">
</div>
'''
                new_lines.append(html)
            else:
                new_lines.append(lines[i])
                i += 1

        return new_lines


class LobotomyExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(LobotomyPreprocessor(md), "lobotomy", 25)
