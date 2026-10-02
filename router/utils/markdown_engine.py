from pathlib import Path

from markdown import Markdown

from config import Constants

from ..extensions import (
    AutoButtonsExtension,
    AutoLinkExtension,
    ButtonExtension,
    CardExtension,
    ColorExtension,
    ConstExtension,
    DialogExtension,
    FolderTreeExtension,
    FootnoteExtension,
    GridExtension,
    ImageExtension,
    LinkPreviewExtension,
    RedactExtension,
    RegistryExtension,
    RestrictedExtension,
    SmallTextExtension,
    StrikethroughExtension,
    StripCommentsExtension,
    TemplateIncludeExtension,
    TocTreeExtension,
    WikiMetaExtension,
)

BASE_DIR = Path(__file__).resolve().parents[2]
WIKI_DIR = BASE_DIR / "wiki"


def get_markdown_eng() -> Markdown:
    return Markdown(
        extensions=[
            # ---
            "fenced_code",  # Блоки кода через тройные кавычки (```), как на GitHub
            "tables",  # Markdown-таблицы
            "smarty",  # Типографические ковычки
            "nl2br",  # Превращает одиночные \n в <br />
            "footnotes",  # Кривые сноски
            # ---
            TocTreeExtension(),  # Автоматическое оглавление по заголовкам
            ConstExtension(constants=Constants.get_all_const()),  # Константы для замены
            StripCommentsExtension(),  # Очистка комментариев
            FolderTreeExtension(),  # Красивое оформление путей и папок
            TemplateIncludeExtension(),  # Вставка однотипных блоков из wiki/_tech/template
            DialogExtension(),  # Обработка диалогов
            RedactExtension(),  # Позволяет динамически отредачить и засекретить информацию
            RegistryExtension(),  # Расширение для особых типов таблиц
            CardExtension(),  # Позволяет билдить карточки
            ColorExtension(),  # Красить текст в разный цвет
            SmallTextExtension(),  # Маленький текст
            StrikethroughExtension(),  # Зачёрктуный текст
            ButtonExtension(),  # Кнопочки
            AutoButtonsExtension(wiki_dir=WIKI_DIR),  # Автоматические кнопочки
            GridExtension(),  # Грид лейаут
            ImageExtension(),  # Картиночки
            RestrictedExtension(),  # Запрещённая информация
            AutoLinkExtension(autolinks_path=WIKI_DIR / "_tech" / "autolinks.md"),
            LinkPreviewExtension(previews_path=WIKI_DIR / "_tech" / "link_previews.md"),
            FootnoteExtension(),  # Менее кривые сноски
            WikiMetaExtension(),  # Заголовки-мета в начале файла (например, автор, дата)
        ],
    )


AI_TEXT_DESP: dict[str, str | None] = {
    "none": None,
    "fix": "ИИ использовался только для исправления орфографии, грамматики и небольших текстовых правок.",
    "edit": "ИИ использовался для заметной редакции, перефразирования или структурирования текста.",
    "gen": "ИИ использовался для генерации значительной части текста.",
}


AI_ART_DESP: dict[str, str | None] = {
    "none": None,
    "ass": "ИИ использовался при обработке или доработке изображений.",
    "gen": "На странице используются изображения, созданные с использованием генеративного ИИ.",
    "mixed": "На странице используются как сгенерированные, так и обработанные  использованием ИИ изображения.",
}


def get_ai_description(
    meta: dict[str, str],
    key: str,
    descriptions: dict[str, str | None],
) -> str | None:
    value = meta.get(key.lower())

    if value is None:
        return None

    value = value.strip().lower()

    return descriptions.get(
        value,
        f"Неизвестное значение '{value}' для {key}",
    )


def get_wiki_page(
    md_path: Path,
    content: str,
) -> tuple[
    str,
    str,
    str | None,
    list[str] | None,
    str | None,
    str | None,
    str | None,
]:
    md = get_markdown_eng()
    setattr(md, "current_file", md_path)  # noqa: B010

    rendered_html = md.convert(content)

    meta: dict[str, str] = getattr(md, "wiki_meta", {})

    title = meta.get("title", "ЗАБЫЛИ НАИМЕНОВАНИЕ УСТАНОВИТЬ")

    date = meta.get("date")

    author_raw = meta.get("author")
    author = [a.strip() for a in author_raw.split(",")] if author_raw else None

    background_url = meta.get("background")

    ai_text = get_ai_description(meta, "AIText", AI_TEXT_DESP)
    ai_art = get_ai_description(meta, "AIArt", AI_ART_DESP)

    return (rendered_html, title, date, author, background_url, ai_text, ai_art)
