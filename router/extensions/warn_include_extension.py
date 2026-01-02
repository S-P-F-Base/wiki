import re
from pathlib import Path

from markdown import Markdown
from markdown.extensions import Extension
from markdown.preprocessors import Preprocessor


class WarnIncludePreprocessor(Preprocessor):
    RE = re.compile(r"(?<!\\)!warn\[(?P<name>[^\]]+)\]")

    def __init__(self, md: Markdown, base_dir: Path):
        super().__init__(md)
        self.base_dir = Path(base_dir).resolve()

    def run(self, lines):
        out = []
        for line in lines:
            m = self.RE.search(line)
            if not m:
                out.append(line)
                continue

            name = m.group("name").strip()
            warn_file = (self.base_dir / f"{name}.md").resolve()

            if not warn_file.exists():
                out.append(f"Template '{name}' not found.")
                continue

            try:
                content = warn_file.read_text(encoding="utf-8").splitlines()
                out.extend(content)
        
            except Exception as e:
                out.append(f"Error reading '{name}': {e}")
        
        return out


class WarnIncludeExtension(Extension):
    def __init__(self, **kwargs):
        self.config = {
            "base_dir": [Path("wiki/_warn"), "Directory for warn templates"],
        }
        super().__init__(**kwargs)

    def extendMarkdown(self, md):
        base_dir = Path(self.getConfig("base_dir"))
        md.preprocessors.register(
            WarnIncludePreprocessor(md, base_dir), "warn_include", 15
        )
