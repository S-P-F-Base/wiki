import re
import xml.etree.ElementTree as etree

from markdown.blockprocessors import BlockProcessor
from markdown.extensions import Extension

from template_env import static_url

from .block_utils import (
    find_end_index,
    find_match_in_lines,
    has_matching_line,
    parse_prefix_blocks,
    push_suffix_block,
)

AI_IMAGE_META = {
    "gen": {
        "mark": "ИИ",
        "title": "Сгенерировано с использованием ИИ",
        "description": "Изображение создано с использованием генеративного ИИ.",
    },
    "ass": {
        "mark": "ИИ ассист",
        "title": "Обработано с использованием ИИ",
        "description": "ИИ использовался при обработке или доработке изображения.",
    },
}


class ImageExtension(Extension):
    def extendMarkdown(self, md):
        md.parser.blockprocessors.register(
            ImageBlockProcessor(md.parser),
            "wiki_image",
            150,
        )

        md.parser.blockprocessors.register(
            ImageFloatBreakProcessor(md.parser),
            "wiki_image_float_break",
            149,
        )


class ImageBlockProcessor(BlockProcessor):
    START_RE = re.compile(r"^\s*!image\[\s*$")
    END_RE = re.compile(r"^\s*\]\s*$")

    def test(self, parent, block):
        return has_matching_line(block, self.START_RE)

    def run(self, parent, blocks):
        block = blocks.pop(0)
        lines = block.splitlines()

        start_idx, _ = find_match_in_lines(lines, self.START_RE)

        if start_idx is None:
            return True

        parse_prefix_blocks(self.parser, parent, lines[:start_idx])

        data: list[str] = []
        ended = False

        for i in range(start_idx + 1, len(lines)):
            line = lines[i]

            if self.END_RE.match(line.strip()):
                push_suffix_block(blocks, lines[i + 1 :])
                ended = True
                break

            if line.strip():
                data.append(line.strip())

        while blocks and not ended:
            blk = blocks.pop(0)
            blk_lines = blk.splitlines()

            end_idx = find_end_index(blk_lines, self.END_RE)

            if end_idx is None:
                for raw in blk_lines:
                    if raw.strip():
                        data.append(raw.strip())

                continue

            for raw in blk_lines[:end_idx]:
                if raw.strip():
                    data.append(raw.strip())

            push_suffix_block(blocks, blk_lines[end_idx + 1 :])
            ended = True
            break

        if not data:
            return True

        url = data[0]
        args = self._parse_args(data[1:])

        wrapper = etree.SubElement(parent, "div")
        wrapper.set("class", self._build_class(args))

        if "width" in args:
            wrapper.set(
                "style",
                f"--img-width:{self._normalize_px(args['width'])};",
            )

        image_content = etree.SubElement(wrapper, "span")
        image_content.set("class", "wiki-image-content")

        img = etree.SubElement(image_content, "img")
        img.set("src", static_url(url))
        img.set("alt", args.get("alt", ""))

        if args.get("lazy") == "true":
            img.set("loading", "lazy")

        self._add_ai_meta(image_content, args)

        return True

    def _parse_args(self, lines):
        out = {}

        for line in lines:
            if "=" not in line:
                continue

            key, value = line.split("=", 1)

            out[key.strip().lower()] = value.strip()

        return out

    def _build_class(self, args):
        classes = ["wiki-image"]

        if "align" in args:
            classes.append(f"align-{args['align'].lower()}")

        return " ".join(classes)

    def _add_ai_meta(self, parent, args):
        ai_value = args.get("ai")

        if ai_value is None:
            return

        ai_value = ai_value.lower()

        if ai_value == "none":
            return

        meta = AI_IMAGE_META.get(ai_value)

        if meta is None:
            meta = {
                "mark": "ИИ?",
                "title": "Неизвестное значение ИИ",
                "description": (
                    f"Неизвестное значение '{ai_value}' для метаданных изображения."
                ),
            }

        ai_wrapper = etree.SubElement(parent, "span")
        ai_wrapper.set(
            "class",
            f"wiki-image-ai-wrapper wiki-image-ai-{ai_value}",
        )

        badge = etree.SubElement(ai_wrapper, "span")
        badge.set("class", "wiki-image-ai-badge")
        badge.set("aria-label", meta["title"])
        badge.text = meta["mark"]

        popup = etree.SubElement(ai_wrapper, "span")
        popup.set("class", "wiki-image-ai-popup")

        popup_title = etree.SubElement(popup, "span")
        popup_title.set("class", "wiki-image-ai-popup-title")
        popup_title.text = meta["title"]

        popup_text = etree.SubElement(popup, "span")
        popup_text.set("class", "wiki-image-ai-popup-text")
        popup_text.text = meta["description"]

    def _normalize_px(self, value):
        return f"{value}px" if value.isdigit() else value


class ImageFloatBreakProcessor(BlockProcessor):
    RE = re.compile(r"^\s*!image_float_break\s*$")

    def test(self, parent, block):
        return has_matching_line(block, self.RE)

    def run(self, parent, blocks):
        block = blocks.pop(0)
        lines = block.splitlines()

        idx, _ = find_match_in_lines(lines, self.RE)

        if idx is None:
            return True

        parse_prefix_blocks(
            self.parser,
            parent,
            lines[:idx],
        )

        div = etree.SubElement(parent, "div")
        div.set(
            "class",
            "wiki-image-float-break",
        )

        push_suffix_block(
            blocks,
            lines[idx + 1 :],
        )

        return True
