import re
import xml.etree.ElementTree as etree

from markdown.extensions import Extension

from template_env import static_url

from .blocks import BRACKET_END_RE, Block, DirectiveBlockProcessor, parse_attributes

AI_IMAGE_META = {
    "gen": {
        "mark": "ИИ",
        "title": "Сгенерировано с использованием ИИ",
        "description": "Изображение создано с использованием генеративного ИИ.",
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


class ImageBlockProcessor(DirectiveBlockProcessor):
    START_RE = re.compile(r"^\s*!image\[\s*$")
    END_RE = BRACKET_END_RE

    def render(self, parent, block: Block):
        data = block.arguments

        if not data:
            return

        url = data[0]
        args = parse_attributes(data[1:], unquote_values=False)

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

        img.set("loading", "eager" if args.get("lazy") == "false" else "lazy")
        img.set("decoding", "async")

        self._add_ai_meta(image_content, args)

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


class ImageFloatBreakProcessor(DirectiveBlockProcessor):
    START_RE = re.compile(r"^\s*!image_float_break\s*$")

    def render(self, parent, block: Block):
        div = etree.SubElement(parent, "div")
        div.set("class", "wiki-image-float-break")
