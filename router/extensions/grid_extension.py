import re
import xml.etree.ElementTree as etree

from markdown.extensions import Extension

from .blocks import Block, DirectiveBlockProcessor


class GridExtension(Extension):
    def extendMarkdown(self, md):
        md.parser.blockprocessors.register(
            GridBlockProcessor(md.parser),
            "wiki_grid",
            15,
        )


class GridBlockProcessor(DirectiveBlockProcessor):
    START_RE = re.compile(r"^\s*!grid(?:\[(?P<cols>\d+)\])?\s*$")
    STEP_RE = re.compile(r"^\s*!grid_step(?:\[(?P<step>\d+)\])?\s*$")
    END_RE = re.compile(r"^\s*!grid_end\s*$")

    def render(self, parent, block: Block):
        cols = int(block.match.group("cols") or 3)
        grid = etree.SubElement(parent, "div")
        grid.set("class", "wiki-grid")
        grid.set("style", f"--grid-cols:{cols};")

        content: list[str] = []
        cell_index = 0
        nested_depth = 0

        def flush_cell():
            if not any(line.strip() for line in content):
                return
            col = (cell_index % cols) + 1
            row = (cell_index // cols) + 1
            cell = etree.SubElement(grid, "div")
            cell.set("class", "wiki-grid-cell")
            cell.set("style", f"grid-column: {col}; grid-row: {row};")
            self.parse_content(cell, content)
            content.clear()

        for line in block.body:
            if self.START_RE.match(line.strip()):
                nested_depth += 1

            elif nested_depth and self.END_RE and self.END_RE.match(line.strip()):
                nested_depth -= 1

            step = self.STEP_RE.match(line.strip()) if not nested_depth else None
            if step:
                flush_cell()
                cell_index += int(step.group("step") or 1)

            else:
                content.append(line)

        flush_cell()
