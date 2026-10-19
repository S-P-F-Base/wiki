"""Examples rendered by the same extensions as actual wiki pages."""

from .editor_document import EditorBlock


def block_samples():
    def directive(kind, props):
        return EditorBlock(
            kind="directive", directive_type=kind, props=props, changed=True
        )

    return [
        (
            "text",
            "Текст",
            EditorBlock(kind="text", markdown="Обычный **текст** и *курсив*."),
        ),
        (
            "heading",
            "Заголовок",
            EditorBlock(kind="heading", level=2, markdown="Заголовок раздела"),
        ),
        (
            "card",
            "Карточка",
            EditorBlock(
                kind="card",
                color="#ff9800",
                children=[EditorBlock(kind="text", markdown="Текст карточки")],
                closing="\n!card_end\n",
            ),
        ),
        (
            "grid",
            "Сетка",
            EditorBlock(
                kind="grid",
                columns=2,
                children=[
                    EditorBlock(
                        kind="cell",
                        children=[EditorBlock(kind="text", markdown="Ячейка 1")],
                    ),
                    EditorBlock(
                        kind="cell",
                        opening="\n!grid_step\n",
                        children=[EditorBlock(kind="text", markdown="Ячейка 2")],
                    ),
                ],
                closing="\n!grid_end\n",
            ),
        ),
        (
            "image",
            "Изображение",
            EditorBlock(
                kind="image",
                path="images/placeholder.svg",
                attrs={"width": "150"},
                changed=True,
            ),
        ),
        (
            "list",
            "Список",
            EditorBlock(
                kind="list",
                props={"items": [{"text": "Первый пункт"}, {"text": "Второй пункт"}]},
                changed=True,
            ),
        ),
        (
            "table",
            "Таблица",
            EditorBlock(
                kind="table",
                props={
                    "headers": ["Название", "Значение"],
                    "rows": [["Параметр", "Данные"]],
                },
                changed=True,
            ),
        ),
        (
            "button",
            "Кнопка страницы",
            directive(
                "button",
                {"title": "Страница", "href": "/wiki/", "desc": "Описание страницы"},
            ),
        ),
        (
            "dialog",
            "Диалог",
            directive(
                "dialog",
                {
                    "participants": [
                        {"key": "a", "name": "Участник", "side": "left"},
                        {"key": "b", "name": "Другой участник", "side": "right"},
                    ],
                    "lines": [
                        {"type": "line", "key": "a", "text": "Привет!"},
                        {"type": "line", "key": "b", "text": "Ответ"},
                    ],
                },
            ),
        ),
        (
            "registry",
            "Реестр",
            directive(
                "registry",
                {
                    "name": "Реестр",
                    "desc": "Описание",
                    "sections": [
                        {
                            "title": "Раздел",
                            "variants": [{"key": "1", "value": "Значение"}],
                        }
                    ],
                },
            ),
        ),
        (
            "folder",
            "Дерево файлов",
            directive(
                "folder", {"paths": ["Документы/файл.txt", "Документы/Изображения/"]}
            ),
        ),
        (
            "restricted",
            "Ограниченный доступ",
            directive(
                "restricted",
                {
                    "title": "Ограниченный доступ",
                    "tag": "RESTRICTED",
                    "state": "BLOCKED",
                    "text": "Сообщение читателю",
                },
            ),
        ),
        (
            "caption",
            "Мелкий текст",
            directive("caption", {"text": "Подпись или примечание"}),
        ),
        ("rule", "Разделитель", EditorBlock(kind="rule")),
        (
            "template",
            "Шаблон",
            EditorBlock(kind="text", markdown="Общий блок для нескольких страниц"),
        ),
        ("auto_buttons", "Список страниц", directive("auto_buttons", {"sort": "abc"})),
        (
            "float_break",
            "Разрыв",
            EditorBlock(
                kind="raw",
                raw="!image[\nimages/placeholder.svg\nwidth=70\nalign=left\n]\n\nТекст рядом\n\n!image_float_break\n\nТекст ниже изображения",
            ),
        ),
    ]
