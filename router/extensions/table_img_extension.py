import re

from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor


class TableImgPreprocessor(Preprocessor):
    RE = re.compile(
        r"!tblimg\[\s*(?P<url>[^\|\]]+)"
        r"(?:\|\s*(?P<size>[^\]]+))?\s*\]",
        re.IGNORECASE,
    )

    def parse_size(self, size_str):
        parts = [part.strip().lower() for part in size_str.split(",")]
        width = parts[0] if len(parts) > 0 else "100%"
        height = parts[1] if len(parts) > 1 else None
        mode = parts[2] if len(parts) > 2 else "max"

        def valid(value):
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

    def run(self, lines):
        new_lines = []

        for line in lines:
            if "|" in line:

                def repl(m):
                    url = m.group("url").strip()
                    size_str = m.group("size") or "100%"
                    width, height, mode = self.parse_size(size_str)

                    if mode == "hard":
                        style = f"width:{width};"
                        if height:
                            style += f" height:{height};"
                    else:
                        style = f"max-width:{width};"
                        if height:
                            style += f" max-height:{height};"

                    return f'<img src="{url}" alt="" style="{style}">'

                line = self.RE.sub(repl, line)

            new_lines.append(line)

        return new_lines


class TableImgExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(TableImgPreprocessor(), "tableimg", 20)
