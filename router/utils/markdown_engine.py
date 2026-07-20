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
    HierarchyExtension,
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
            "tables",  # Markdown-таблицы
            "footnotes",  # Кривые сноски
            # ---
            TocTreeExtension(),  # Автоматическое оглавление по заголовкам
            ConstExtension(constants=Constants.get_all_const()),  # Константы для замены
            StripCommentsExtension(),  # Очистка комментариев
            FolderTreeExtension(),  # Красивое оформление путей и папок
            HierarchyExtension(
                branch_threshold=3,
                max_chain_length=4,
            ),  # Адаптивные иерархические схемы: цепочки и ветки
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
]:
    md = get_markdown_eng()
    setattr(md, "current_file", md_path)
    rendered_html = md.convert(content)

    meta: dict[str, str] = getattr(md, "wiki_meta", {})

    title = meta.get("title", "ЗАБЫЛИ НАИМЕНОВАНИЕ УСТАНОВИТЬ")

    date = meta.get("date")

    author: list[str] | None = None
    author_raw = meta.get("author")
    author = [a.strip() for a in author_raw.split(",")] if author_raw else None

    background_url = meta.get("background")

    ai_use = meta.get("aiuse", None)
    if ai_use:
        ai_use = ai_use.lower()

    return rendered_html, title, date, author, background_url, ai_use
