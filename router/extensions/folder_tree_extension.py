import re

from markdown.extensions import Extension

from .blocks import BRACKET_END_RE, Block, DirectivePreprocessor


class FolderTreeExtension(Extension):
    def extendMarkdown(self, md):
        md.preprocessors.register(FolderTreePreprocessor(md), "foldertree", 25)


class FolderTreePreprocessor(DirectivePreprocessor):
    START_RE = re.compile(r"^!folder\[\s*$")
    END_RE = BRACKET_END_RE

    def render(self, block: Block):
        paths = block.arguments
        tree = {}
        for path_str in paths:
            parts = path_str.strip("/").split("/")
            cur = tree
            for part in parts:
                cur = cur.setdefault(part, {})

        def render(node: dict, prefix: str = "") -> list[str]:
            out = []
            items = sorted(
                node.items(),
                key=lambda item: (0 if item[1] else 1, item[0].lower()),
            )
            for idx, (name, sub) in enumerate(items):
                last = idx == len(items) - 1
                connector = "└── " if last else "├── "
                display = name + ("/" if sub else "")
                out.append(f"{prefix}{connector}{display}")
                ext = "    " if last else "│   "
                out.extend(render(sub, prefix + ext))

            return out

        roots = {p.strip("/").split("/")[0] for p in paths}
        if len(roots) == 1:
            root = roots.pop()
            lines_tree = [f"/{root}"]
            for line in render(tree[root], ""):
                lines_tree.append(" " + line)

        else:
            lines_tree = render(tree, "")

        return "\n".join(
            [
                '<div class="foldertree">',
                "<pre>",
                *lines_tree,
                "</pre>",
                "</div>",
            ]
        )
