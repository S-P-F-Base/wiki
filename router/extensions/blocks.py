"""Common parsing for wiki directives; extensions only implement their rendering."""

from __future__ import annotations

import re
from collections.abc import Sequence
from dataclasses import dataclass, field
from xml.etree.ElementTree import Element

from markdown.blockprocessors import BlockProcessor
from markdown.preprocessors import Preprocessor

BRACKET_END_RE = re.compile(r"^\s*]\s*$")
SHORT_HEADER_END_RE = re.compile(r"^\s*(?P<escaped>\\)?]\s*$")
OPTION_RE = re.compile(r'(\w+)=(?:"([^"]+)"|([^\s]+))')
QUOTE_PAIRS = {'"': '"', "'": "'", "«": "»", "„": "“", "“": "”", "”": "“"}


def find_line(
    lines: Sequence[str],
    pattern: re.Pattern[str],
    start: int = 0,
) -> tuple[int | None, re.Match[str] | None]:
    for index in range(start, len(lines)):
        match = pattern.match(lines[index].strip())
        if match:
            return index, match

    return None, None


def unquote(value: str) -> str:
    value = value.strip()
    if len(value) >= 2:
        first, last = value[0], value[-1]
        if (first == last and first in "\"'«»„“”") or QUOTE_PAIRS.get(first) == last:
            return value[1:-1].strip()

    return value


def parse_options(text: str) -> dict[str, str]:
    """Read inline options: name=Alice avatar=path or name=\"Alice Smith\"."""
    return {key: quoted or plain for key, quoted, plain in OPTION_RE.findall(text)}


def parse_attributes(
    lines: Sequence[str],
    *,
    unquote_values: bool = True,
) -> dict[str, str]:
    """Read one key=value per line; values may contain spaces and quotes."""
    attrs = {}
    for line in lines:
        if "=" in line:
            key, value = line.split("=", 1)
            key = key.strip().lower()
            if key:
                attrs[key] = unquote(value) if unquote_values else value.strip()

    return attrs


@dataclass
class Block:
    match: re.Match[str]
    body: list[str]
    header: list[str] = field(default_factory=list)

    @property
    def arguments(self) -> list[str]:
        return [line.strip() for line in self.body if line.strip()]


class DirectiveBlockProcessor(BlockProcessor):
    """A single command, or a delimited block containing Markdown or arguments.

    Define START_RE, optionally END_RE, and render(parent, block). Rendering may
    append HTML elements or return generated Markdown to process next.
    """

    START_RE: re.Pattern[str]
    END_RE: re.Pattern[str] | None = None

    def test(self, parent: Element, block: str) -> bool:
        processors = [
            p
            for p in self.parser.blockprocessors
            if isinstance(p, DirectiveBlockProcessor)
        ]
        for line in block.splitlines():
            for processor in processors:
                if processor.START_RE.match(line.strip()):
                    return processor is self

        return False

    def run(self, parent: Element, blocks: list[str]) -> bool:
        lines = blocks[0].splitlines()
        start, match = find_line(lines, self.START_RE)
        if start is None or match is None:
            return False

        blocks.pop(0)
        self.parse_content(parent, lines[:start])
        body = self._take_body(lines[start + 1 :], blocks)
        replacement = self.render(parent, Block(match, body))
        if replacement:
            blocks[:0] = replacement.split("\n\n")

        return True

    def _take_body(self, lines: list[str], blocks: list[str]) -> list[str]:
        if self.END_RE is None:
            self._put_back(blocks, lines)
            return []

        body: list[str] = []
        depth = 0
        while True:
            for index, line in enumerate(lines):
                if self.START_RE.match(line.strip()):
                    depth += 1

                elif self.END_RE.match(line.strip()):
                    if depth:
                        depth -= 1

                    else:
                        self._put_back(blocks, lines[index + 1 :])
                        return body

                body.append(line)

            if not blocks:
                return body

            body.append("")
            lines = blocks.pop(0).splitlines()

    @staticmethod
    def _put_back(blocks: list[str], lines: Sequence[str]) -> None:
        text = "\n".join(lines).strip("\n")
        if text.strip():
            blocks.insert(0, text)

    def parse_content(self, parent: Element, lines: Sequence[str]) -> None:
        text = "\n".join(lines).strip("\n")
        if text.strip():
            self.parser.parseBlocks(parent, text.split("\n\n"))

    def render(self, parent: Element, block: Block) -> str | None:
        raise NotImplementedError


class DirectivePreprocessor(Preprocessor):
    """A text block, optionally with a header terminated by ] or short form \\]."""

    START_RE: re.Pattern[str]
    END_RE: re.Pattern[str]
    HEADER_END_RE: re.Pattern[str] | None = None
    ALLOW_UNCLOSED_BODY = True

    def run(self, lines: list[str]) -> list[str]:
        out = []
        index = 0
        while index < len(lines):
            match = self.START_RE.match(lines[index].strip())
            if match is None:
                out.append(lines[index])
                index += 1
                continue

            index += 1
            header: list[str] = []
            short = False
            if self.HEADER_END_RE is not None:
                end, closing = find_line(lines, self.HEADER_END_RE, index)
                if end is None:
                    out.extend(lines[index - 1 :])
                    break

                header = lines[index:end]
                short = bool(closing and closing.groupdict().get("escaped"))
                index = end + 1

            body: list[str] = []
            if not short:
                end, _ = find_line(lines, self.END_RE, index)
                if end is not None:
                    body = lines[index:end]
                    index = end + 1

                elif self.ALLOW_UNCLOSED_BODY:
                    body = lines[index:]
                    index = len(lines)

            out.append(self.render(Block(match, body, header)))

        return out

    def render(self, block: Block) -> str:
        raise NotImplementedError
