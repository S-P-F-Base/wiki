"use strict";

const blockNames = {
    grid: "Сетка",
    cell: "Ячейка",
    button: "Кнопка",
    dialog: "Диалог",
    registry: "Реестр",
    restricted: "Ограниченный доступ",
    folder: "Дерево файлов",
    auto_buttons: "Список страниц",
    float_break: "Разрыв",
    caption: "Мелкий текст"
};
let formBlock;

function field(parent, label, value, update, choices = null, multiline = false) {
    const wrapper = document.createElement("label");
    wrapper.textContent = label;
    const input = document.createElement(choices ? "select" : multiline ? "textarea" : "input");
    if (choices)
        for (const [key, title] of choices) input.add(new Option(title, key));
    if (multiline) input.rows = 3;
    input.value = value ?? "";
    input.addEventListener("input", function () {
        update(input.value);
    });
    wrapper.appendChild(input);
    parent.appendChild(wrapper);
    return input;
}

function action(parent, label, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", callback);
    parent.appendChild(button);
    return button;
}

function formChanged() {
    remember("block:" + formBlock.id);
    formBlock.changed = true;
    changed();
}

function property(parent, label, key, object = formBlock.props, choices = null, multiline = false) {
    return field(parent, label, object[key], function (value) {
        formChanged();
        object[key] = value;
        if (key === 'text' && formBlock.directive_type === 'caption') delete object.markdown;
    }, choices, multiline);
}

function imageProperty(parent, label, key, object = formBlock.props) {
    const row = document.createElement("div");
    row.className = "image-property";
    const name = document.createElement("span");
    name.textContent = label + ": " + (object[key]?.split("/").pop() || "не выбрано");
    row.appendChild(name);
    action(row, "Выбрать", function () {
        openMedia({
            settings: function (path) {
                formChanged();
                object[key] = path;
                name.textContent = label + ": " + path.split("/").pop();
            },
            value: object[key]
        });
    });
    action(row, "Убрать", function () {
        formChanged();
        object[key] = "";
        name.textContent = label + ": не выбрано";
    });
    parent.appendChild(row);
}

function openBlock(id) {
    const found = findBlock(id);
    if (!found) return;
    formBlock = found.node;
    dialogPage = 0;
    fillBlockForm();
    document.getElementById("block-dialog").showModal();
    scheduleBlockPreview();
}

function fillBlockForm() {
    const root = document.getElementById("block-fields");
    root.replaceChildren();
    const node = formBlock;
    const kind = node.kind === "directive" ? node.directive_type : node.kind;
    document.getElementById("block-title").textContent = blockNames[kind] || "Настройки блока";
    if (kind === "grid") {
        const columns = field(root, "Число колонок", node.columns || 3, function (value) {
            if (+value >= 1 && +value <= 24) {
                formChanged();
                node.columns = +value;
            }
        });
        columns.type = "number";
        columns.min = "1";
        columns.max = "24";
        for (const entry of gridEntries(node)) {
            const {
                cell,
                position
            } = entry;
            const row = document.createElement('div');
            row.className = 'grid-cell-row';
            const label = document.createElement('span');
            label.textContent = 'Ячейка: ' + (position + 1);
            row.appendChild(label);
            const place = field(row, 'Позиция в сетке', position + 1, function (value) {
                if (Number.isInteger(+value) && +value >= 1 && +value <= 10000) {
                    formChanged();
                    moveGridCell(node, cell.id, +value - 1);
                }
            });
            place.type = 'number';
            place.min = '1';
            place.max = '10000';
            place.className = 'cell-gap';
            action(row, '←', function () {
                gridAction({
                    grid: node.id,
                    cell: cell.id,
                    action: 'left'
                });
                fillBlockForm();
            }).disabled = position === 0;
            action(row, '→', function () {
                gridAction({
                    grid: node.id,
                    cell: cell.id,
                    action: 'right'
                });
                fillBlockForm();
            });
            action(row, '＋ Блок', function () {
                document.getElementById('block-dialog').close();
                openBlockPalette(cell.id, 'inside');
            });
            action(row, 'Удалить', function () {
                gridAction({
                    grid: node.id,
                    cell: cell.id,
                    action: 'delete'
                });
                fillBlockForm();
            });
            root.appendChild(row);
        }
        const hint = document.createElement('p');
        hint.textContent =
            'Позиции считаются слева направо, затем по рядам. Пустое место можно заполнить кнопкой ＋ прямо на странице.';
        root.appendChild(hint);
        action(root, 'Добавить ячейку', function () {
            gridAction({
                grid: node.id,
                action: 'add'
            });
            fillBlockForm();
        });
        return;
    }
    const props = node.props;
    if (kind === 'table') {
        const hint = document.createElement('p');
        hint.textContent =
            'Двойной щелчок по ячейке на странице: изменить текст. Здесь можно настроить столбцы и строки.';
        root.appendChild(hint);
        for (const [index, header] of props.headers.entries()) {
            const row = document.createElement('div');
            row.className = 'variant-fields';
            field(row, 'Заголовок', header, function (value) {
                formChanged();
                props.headers[index] = value;
            });
            field(row, 'Выравнивание', props.align[index] || '', function (value) {
                formChanged();
                props.align[index] = value;
            }, [
                ['', 'По умолчанию'],
                ['left', 'Слева'],
                ['center', 'По центру'],
                ['right', 'Справа']
            ]);
            action(row, '×', function () {
                if (props.headers.length === 1) return;
                formChanged();
                props.headers.splice(index, 1);
                props.align.splice(index, 1);
                for (const values of props.rows) values.splice(index, 1);
                fillBlockForm();
            });
            root.appendChild(row);
        }
        action(root, 'Добавить колонку', function () {
            tableAction({
                id: node.id,
                action: 'column'
            });
            fillBlockForm();
        });
        action(root, 'Добавить строку', function () {
            tableAction({
                id: node.id,
                action: 'row'
            });
            fillBlockForm();
        });
        for (const [index, values] of props.rows.entries()) {
            const row = document.createElement('div');
            row.className = 'form-entry';
            for (const [column, value] of values.entries()) field(row, props.headers[column] || 'Ячейка',
                value,
                function (text) {
                    formChanged();
                    values[column] = text;
                });
            action(row, 'Удалить строку ' + (index + 1), function () {
                formChanged();
                props.rows.splice(index, 1);
                fillBlockForm();
            });
            root.appendChild(row);
        }
    } else if (kind === 'list') {
        field(root, 'Тип списка', props.ordered ? 'ordered' : 'unordered', function (value) {
            formChanged();
            props.ordered = value === 'ordered';
        }, [
            ['unordered', 'Маркеры'],
            ['ordered', 'Нумерация']
        ]);
        const hint = document.createElement('p');
        hint.textContent =
            'Двойной щелчок по пункту: редактировать. Enter добавляет пункт, Tab меняет вложенность, Enter на пустом последнем пункте завершает список.';
        root.appendChild(hint);
    } else if (kind === 'caption') {
        property(root, 'Текст', 'text');
    } else if (kind === "button") {
        property(root, "Название", "title");
        const options = [
            ["", "Выбрать страницу…"], ...pages.map(function (page) {
                return [page.url, page.title + ": " + page.path];
            })
        ];
        field(root, "Страница вики", props.href, function (value) {
            if (value) {
                formChanged();
                props.href = value;
                fillBlockForm();
            }
        }, options);
        property(root, "Или адрес ссылки", "href");
        property(root, "Описание", "desc");
        imageProperty(root, "Изображение", "image");
    } else if (kind === "restricted") {
        property(root, "Заголовок", "title");
        property(root, "Метка", "tag");
        property(root, "Статус", "state");
        property(root, "Текст", "text", props, null, true);
    } else if (kind === "auto_buttons") {
        property(root, "Сортировка", "sort", props, [
            ["abc", "По названию"],
            ["time", "По дате"]
        ]);
    } else if (kind === "folder") {
        folderForm(root, props);
    } else if (kind === "dialog") {
        const heading = document.createElement("h3");
        heading.textContent = "Участники";
        root.appendChild(heading);
        for (const [index, person] of (props.participants || []).entries()) {
            const row = document.createElement("section");
            row.className = "form-entry";
            const heading = document.createElement('strong');
            heading.textContent = 'Участник ' + (index + 1);
            row.appendChild(heading);
            const name = property(row, "Имя", "name", person);
            name.addEventListener('input', function () {
                for (const select of root.querySelectorAll('select[data-participant-select]'))
                    for (const option of select.options)
                        if (option.value === person.key) option.text = (person.name || 'Участник') +
                            ' (' + (index + 1) + ')';
            });
            property(row, "Сторона", "side", person, [
                ["left", "Слева"],
                ["right", "Справа"],
                ["center", "По центру"]
            ]);
            imageProperty(row, "Аватар", "avatar", person);
            action(row, "Убрать участника, сохранить реплики", function () {
                formChanged();
                props.participants.splice(index, 1);
                props.lines = props.lines.filter(function (line) {
                    return line.type !== 'update' || line.key !== person.key;
                });
                for (const line of props.lines)
                    if (line.key === person.key) {
                        line.key = '';
                        line.type = 'system';
                    }
                fillBlockForm();
            });
            root.appendChild(row);
        }
        action(root, "Добавить участника", function () {
            formChanged();
            const keys = new Set(props.participants.map(function (person) {
                return person.key;
            }));
            let number = 1;
            while (keys.has('actor' + number)) number++;
            props.participants.push({
                key: 'actor' + number,
                name: 'Участник',
                side: 'left'
            });
            fillBlockForm();
        });
        const title = document.createElement("h3");
        title.textContent = "Реплики";
        root.appendChild(title);
        const pageSize = 25;
        dialogPage = Math.min(dialogPage, Math.max(0, Math.ceil(props.lines.length / pageSize) - 1));
        const pager = document.createElement('div');
        pager.className = 'dialog-pages';
        action(pager, '←', function () {
            dialogPage--;
            fillBlockForm();
        }).disabled = dialogPage === 0;
        const count = document.createElement('span');
        count.textContent = 'Реплики ' + (dialogPage * pageSize + 1) + '–' + Math.min((dialogPage + 1) *
            pageSize, props.lines.length) + ' из ' + props.lines.length;
        pager.appendChild(count);
        action(pager, '→', function () {
            dialogPage++;
            fillBlockForm();
        }).disabled = (dialogPage + 1) * pageSize >= props.lines.length;
        root.appendChild(pager);
        for (let index = dialogPage * pageSize; index < Math.min((dialogPage + 1) * pageSize, props.lines
            .length); index++) {
            const line = props.lines[index];
            const row = document.createElement("section");
            row.className = "form-entry";
            if (line.type === "update") {
                const label = document.createElement("p");
                label.textContent = "Изменение участника: " + (props.participants.find(function (person) {
                    return person.key === line.key;
                })?.name || 'Участник');
                row.appendChild(label);
                property(row, "Имя", "name", line.opts);
                imageProperty(row, "Аватар", "avatar", line.opts);
            } else {
                const options = [
                    ["", "Системное сообщение"], ...props.participants.map(function (person, index) {
                        return [person.key, (person.name || 'Участник') + ' (' + (index + 1) + ')'];
                    })
                ];
                const speaker = field(row, "Кто говорит", line.type === "system" ? "" : line.key, function (
                    value) {
                    formChanged();
                    line.type = value ? "line" : "system";
                    line.key = value;
                }, options);
                speaker.dataset.participantSelect = '1';
                property(row, "Текст", "text", line);
            }
            action(row, "Удалить реплику", function () {
                formChanged();
                props.lines.splice(index, 1);
                fillBlockForm();
            });
            root.appendChild(row);
        }
        action(root, "Добавить реплику", function () {
            formChanged();
            props.lines.push({
                type: "line",
                key: props.participants[0]?.key || "",
                text: "Реплика"
            });
            dialogPage = Math.floor((props.lines.length - 1) / pageSize);
            fillBlockForm();
        });
    } else if (kind === "registry") {
        property(root, "Название", "name");
        property(root, "Описание", "desc");
        for (const [index, section] of (props.sections || []).entries()) {
            const row = document.createElement("section");
            row.className = "form-entry";
            property(row, "Раздел", "title", section);
            field(row, "Текст", (section.text || []).join("\n"), function (value) {
                formChanged();
                section.text = value.split("\n");
            }, null, true);
            for (const [position, variant] of (section.variants || []).entries()) {
                const pair = document.createElement("div");
                pair.className = "variant-fields";
                property(pair, "Параметр", "key", variant);
                property(pair, "Значение", "value", variant);
                action(pair, "×", function () {
                    formChanged();
                    section.variants.splice(position, 1);
                    fillBlockForm();
                });
                row.appendChild(pair);
            }
            action(row, "Добавить параметр", function () {
                formChanged();
                section.variants.push({
                    key: "Параметр",
                    value: "Значение"
                });
                fillBlockForm();
            });
            action(row, "Удалить раздел", function () {
                formChanged();
                props.sections.splice(index, 1);
                fillBlockForm();
            });
            root.appendChild(row);
        }
        action(root, "Добавить раздел", function () {
            formChanged();
            props.sections.push({
                title: "Раздел",
                text: [],
                variants: []
            });
            fillBlockForm();
        });
    }
}

function newCell(withStep) {
    return newBlock("cell", {
        opening: withStep ? "\n\n!grid_step\n\n" : "",
        step: 1,
        children: []
    });
}

function addGrid() {
    const node = newBlock("grid", {
        columns: 2,
        closing: "\n\n!grid_end\n\n",
        children: [newCell(false), newCell(true)]
    });
    insertBlock(node);
    openBlock(node.id);
}

function addDirective(kind) {
    const defaults = {
        button: {
            title: "Кнопка",
            href: "/wiki/",
            desc: "",
            image: ""
        },
        restricted: {
            title: "Ограниченный доступ",
            tag: "RESTRICTED",
            state: "BLOCKED",
            text: "Текст"
        },
        folder: {
            paths: ["folder/file"]
        },
        auto_buttons: {
            sort: "abc"
        },
        float_break: {},
        caption: {
            text: 'Мелкий текст'
        },
        dialog: {
            participants: [{
                key: "actor1",
                name: "Участник",
                side: "left"
            }],
            lines: [{
                type: "line",
                key: "actor1",
                text: "Реплика"
            }]
        },
        registry: {
            name: "Реестр",
            desc: "",
            sections: [{
                title: "Раздел",
                text: [],
                variants: []
            }]
        }
    };
    const node = newBlock("directive", {
        directive_type: kind,
        props: defaults[kind],
        changed: true
    });
    insertBlock(node);
    if (kind !== 'float_break') openBlock(node.id);
    else {
        const found = findBlock(node.id);
        let following = found.nodes[found.index + 1];
        if (!following || following.kind !== 'text') {
            following = newBlock('text', {
                markdown: ''
            });
            found.nodes.splice(found.index + 1, 0, following);
        }
        pendingFocus = following.id;
    }
}
async function openTemplates() {
    const dialog = document.getElementById('templates-dialog');
    const list = document.getElementById('templates-list');
    list.replaceChildren();
    document.getElementById('template-status').textContent = '';
    dialog.showModal();
    try {
        const result = await api('/editor/api/templates');
        for (const template of result.templates) {
            const row = document.createElement('section');
            row.className = 'template-entry';
            const name = document.createElement('strong');
            name.textContent = template.name;
            row.appendChild(name);
            action(row, 'Вставить', function () {
                dialog.close();
                insertBlock(newBlock('template', {
                    path: template.name,
                    changed: true
                }));
            });
            action(row, 'Открыть', function () {
                dialog.close();
                openPage(template.path);
            });
            list.appendChild(row);
        }
        if (!result.templates.length) list.textContent =
            'Шаблонов пока нет. Создай их в разделе «Шаблоны» слева.';
    } catch (error) {
        document.getElementById('template-status').textContent = error.message;
    }
}

let inlineTarget;
let inlineConstants = {};
async function openInlineToken(kind, token = null) {
    inlineTarget = token || {
        id: selectedTextId,
        kind,
        value: selectedText
    };
    document.getElementById('inline-title').textContent = kind === 'constant' ? 'Константа' :
        'Засекреченный текст';
    document.getElementById('inline-text-label').hidden = kind === 'constant';
    document.getElementById('inline-constant-label').hidden = kind !== 'constant';
    const input = document.getElementById('inline-text');
    input.value = inlineTarget.value || '';
    input.setCustomValidity('');
    if (kind === 'constant') {
        try {
            const values = await api('/editor/api/constants');
            inlineConstants = values;
            const select = document.getElementById('inline-constant');
            select.replaceChildren();
            for (const [key, value] of Object.entries(values)) select.add(new Option(value + ' (' + key +
                ')', key));
            if (token?.value) {
                if (!(token.value in values)) select.add(new Option('Неизвестная константа: ' + token
                    .value, token.value));
                select.value = token.value;
            }
        } catch (error) {
            setStatus(error.message, true);
            return;
        }
    }
    document.getElementById('inline-dialog').showModal();
}
document.getElementById('redact-text').addEventListener('pointerdown', function (event) {
    event.preventDefault();
});
document.getElementById('constant-text').addEventListener('pointerdown', function (event) {
    event.preventDefault();
});
document.getElementById('redact-text').addEventListener('click', function () {
    openInlineToken('redact');
});
document.getElementById('constant-text').addEventListener('click', function () {
    openInlineToken('constant');
});
document.getElementById('inline-text').addEventListener('input', function (event) {
    event.target.setCustomValidity('');
});
document.getElementById('inline-form').addEventListener('submit', function (event) {
    event.preventDefault();
    const input = document.getElementById('inline-text');
    const value = inlineTarget.kind === 'constant' ? document.getElementById('inline-constant')
        .value : input.value;
    if (!value || /[\]\r\n]/.test(value)) {
        input.setCustomValidity('Введи непустой текст без квадратной скобки ]');
        input.reportValidity();
        return;
    }
    document.getElementById('inline-dialog').close();
    sendToFrame({
        type: 'wiki-token',
        id: inlineTarget.id,
        kind: inlineTarget.kind,
        value,
        display: inlineConstants[value],
        index: inlineTarget.index
    });
});
document.getElementById('text-color').addEventListener('input', function (event) {
    sendToFrame({
        type: 'wiki-format',
        format: 'color',
        value: event.target.value,
        id: selectedTextId
    });
});
document.getElementById('text-color').addEventListener('pointerdown', function () {
    lastEdit = '';
});

function openBlockPalette(id = '', placement = 'after') {
    if (!current || busy || loading) return;
    pendingInsertion = null;
    paletteCursorPoint = null;
    contextTarget = id;
    contextPlacement = placement;
    const found = findBlock(id);
    const select = document.getElementById('block-placement');
    select.replaceChildren();
    if (found) {
        if (['card', 'grid', 'cell'].includes(found.node.kind)) select.add(new Option(
            'Внутрь выбранного блока', 'inside'));
        select.add(new Option('Перед выбранным блоком', 'before'));
        select.add(new Option('После выбранного блока', 'after'));
    } else select.add(new Option('В конец страницы', 'after'));
    select.value = placement;
    if (select.selectedIndex < 0) select.selectedIndex = 0;
    if (found && ['text', 'heading'].includes(found.node.kind) && selectedTextId === id) select.add(
        new Option('В месте курсора', 'cursor'));
    if (placement === 'cursor') select.value = 'cursor';
    const samples = document.getElementById('palette-samples');
    if (!samples.getAttribute('src')) {
        samples.classList.add('preview-loading');
        samples.src = '/editor/api/block-samples';
    }
    if (selectedTextId === id) sendToFrame({
        type: 'wiki-insertion-point',
        id: selectedTextId
    });
    document.getElementById('block-palette').showModal();
}
document.getElementById('add-block').addEventListener('click', function () {
    openBlockPalette(selectedBlockId, selectedTextId === selectedBlockId ? 'cursor' : 'after');
});

function insertPaletteBlock(kind) {
    if (kind === 'text') insertBlock(newBlock('text', {
        markdown: ''
    }));
    else if (kind === 'heading') insertBlock(newBlock('heading', {
        level: 2,
        markdown: 'Новый заголовок'
    }));
    else if (kind === 'card') openCard('');
    else if (kind === 'grid') addGrid();
    else if (kind === 'image') openMedia({
        insert: contextTarget
    });
    else if (kind === 'template') openTemplates();
    else if (kind === 'rule') insertBlock(newBlock('rule'));
    else if (kind === 'table') {
        const node = newBlock('table', {
            props: {
                headers: ['Название', 'Значение'],
                rows: [
                    ['', '']
                ],
                align: ['', '']
            },
            changed: true
        });
        insertBlock(node);
        openBlock(node.id);
    } else if (kind === 'list') {
        const node = newBlock('list', {
            props: {
                ordered: false,
                items: [{
                    text: 'Первый пункт',
                    indent: 0,
                    ordered: false
                }]
            },
            changed: true
        });
        insertBlock(node);
        pendingFocus = node.id + '-item-0';
    } else addDirective(kind);

}
const paletteFrame = document.getElementById('palette-samples');
paletteFrame.addEventListener('load', function () {
    paletteFrame.classList.remove('preview-loading');
    document.getElementById('palette-status').hidden = true;
});
let palettePendingKind = '';
let paletteCursorPoint = null;
window.addEventListener('message', function (event) {
    if (event.source === paletteFrame.contentWindow && event.data?.type === 'wiki-palette-select') {
        const kind = event.data.kind;
        contextPlacement = document.getElementById('block-placement').value;
        document.getElementById('block-palette').close();
        if (contextPlacement === 'cursor') {
            if (paletteCursorPoint) {
                pendingInsertion = paletteCursorPoint;
                insertPaletteBlock(kind);
            } else {
                palettePendingKind = kind;
                sendToFrame({
                    type: 'wiki-insertion-point',
                    id: selectedTextId
                });
            }
        } else insertPaletteBlock(kind);
    }
    if (event.source === frame.contentWindow && event.data?.type === 'wiki-insertion-point') {
        paletteCursorPoint = event.data;
        if (palettePendingKind) {
            pendingInsertion = event.data;
            sendToFrame({
                type: 'wiki-blur'
            });
            contextTarget = event.data.id;
            insertPaletteBlock(palettePendingKind);
            palettePendingKind = '';
        }
    }
});

let blockPreviewTimer;
let blockPreviewController;
let blockPreviewSequence = 0;
const blockPreviewFrame = document.getElementById('block-preview-frame');

function scheduleBlockPreview() {
    clearTimeout(blockPreviewTimer);
    blockPreviewTimer = setTimeout(updateBlockPreview, 200);
}
async function updateBlockPreview() {
    if (!formBlock || !document.getElementById('block-dialog').open) return;
    blockPreviewController?.abort();
    blockPreviewController = new AbortController();
    const sequence = ++blockPreviewSequence;
    try {
        let node = formBlock;
        let previewTitle = 'Предпросмотр';
        if (node.directive_type === 'dialog' && node.props.lines.length > 80) {
            const start = Math.max(0, dialogPage * 25 - 10),
                end = Math.min(start + 80, node.props.lines.length);
            const participants = node.props.participants.map(function (person) {
                return {
                    ...person
                };
            });
            const byKey = new Map(participants.map(function (person) {
                return [person.key, person];
            }));
            for (let index = 0; index < start; index++) {
                const line = node.props.lines[index];
                if (line.type === 'update' && byKey.has(line.key)) Object.assign(byKey.get(line.key), line
                    .opts);
            }
            previewTitle = 'Предпросмотр: реплики ' + (start + 1) + '–' + end + ' из ' + node.props.lines
                .length;
            node = {
                ...node,
                raw: '',
                changed: true,
                props: {
                    ...node.props,
                    participants,
                    lines: node.props.lines.slice(start, end)
                }
            };
        }
        document.querySelector('.block-preview > span').textContent = previewTitle;
        const response = await fetch('/editor/api/preview?component=true', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...draft(),
                meta: {},
                blocks: [node]
            }),
            signal: blockPreviewController.signal
        });
        if (!response.ok) return;
        const result = await response.json();
        if (sequence === blockPreviewSequence) patchPreview(blockPreviewFrame, {
            ...result,
            kinds: {},
            sequence
        });
    } catch (error) {
        if (error.name !== 'AbortError') setStatus(error.message, true);
    }
}
document.getElementById('block-dialog').addEventListener('input', scheduleBlockPreview);
document.getElementById('block-dialog').addEventListener('click', scheduleBlockPreview);
document.getElementById('block-dialog').addEventListener('close', function () {
    clearTimeout(blockPreviewTimer);
    blockPreviewController?.abort();
    updatePreview();
});

let dialogPage = 0;

function folderForm(root, props) {
    const tree = {
        name: '',
        folder: true,
        children: []
    };
    for (const path of props.paths || []) {
        const parts = path.split('/').filter(Boolean);
        let currentFolder = tree;
        for (const [index, name] of parts.entries()) {
            let entry = currentFolder.children.find(function (item) {
                return item.name === name;
            });
            if (!entry) {
                entry = {
                    name,
                    folder: index < parts.length - 1 || path.endsWith('/'),
                    children: []
                };
                currentFolder.children.push(entry);
            }
            if (index < parts.length - 1) entry.folder = true;
            currentFolder = entry;
        }
    }

    function commit() {
        const paths = [];

        function walk(node, prefix) {
            for (const child of node.children) {
                const path = prefix + child.name;
                if (!child.folder || !child.children.length) paths.push(path + (child.folder ? '/' : ''));
                if (child.children.length) walk(child, path + '/');
            }
        }
        walk(tree, '');
        props.paths = paths;
        scheduleBlockPreview();
    }
    const container = document.createElement('div');
    container.className = 'folder-editor';
    root.appendChild(container);

    function add(parent, folder) {
        formChanged();
        let name = folder ? 'Новая папка' : 'файл.txt';
        let number = 2;
        while (parent.children.some(function (entry) {
            return entry.name === name;
        })) name = (folder ? 'Новая папка ' : 'файл ') + number++ + (folder ? '' : '.txt');
        parent.folder = true;
        parent.children.push({
            name,
            folder,
            children: []
        });
        commit();
        draw();
    }

    function draw() {
        container.replaceChildren();

        function branch(parent, host) {
            const list = document.createElement('ul');
            host.appendChild(list);
            for (const item of parent.children) {
                const li = document.createElement('li'),
                    row = document.createElement('div');
                row.className = 'folder-row';
                const icon = document.createElement('span');
                icon.textContent = item.folder ? '▱' : '▤';
                const name = document.createElement('input');
                name.value = item.name;
                name.setAttribute('aria-label', item.folder ? 'Имя папки' : 'Имя файла');
                name.addEventListener('input', function () {
                    const value = name.value.trim();
                    name.setCustomValidity(!value || /[\/\\\r\n]/.test(value) || parent.children.some(
                        function (other) {
                            return other !== item && other.name === value;
                        }) ? 'Укажи уникальное имя без слешей' : '');
                    if (!name.checkValidity()) {
                        name.reportValidity();
                        return;
                    }
                    formChanged();
                    item.name = value;
                    commit();
                });
                row.append(icon, name);
                if (item.folder) {
                    action(row, '＋▱', function () {
                        add(item, true);
                    }).title = 'Добавить папку';
                    action(row, '＋▤', function () {
                        add(item, false);
                    }).title = 'Добавить файл';
                }
                action(row, '×', function () {
                    formChanged();
                    parent.children.splice(parent.children.indexOf(item), 1);
                    commit();
                    draw();
                }).title = 'Удалить';
                li.appendChild(row);
                if (item.children.length) branch(item, li);
                list.appendChild(li);
            }
        }
        branch(tree, container);
        action(container, 'Добавить папку', function () {
            add(tree, true);
        });
        action(container, 'Добавить файл', function () {
            add(tree, false);
        });
    }
    draw();
}

function gridAction(data) {
    const grid = findBlock(data.grid)?.node;
    if (!grid || grid.kind !== 'grid') return;
    if (data.action === 'settings') {
        openBlock(grid.id);
        return;
    }
    remember();
    const entries = gridEntries(grid);
    const next = entries.length ? entries[entries.length - 1].position + 1 : 0;
    let inserted;
    if (data.action === 'columns') grid.columns = Math.max(1, Math.min(24, +data.value || 2));
    else if (data.action === 'add' || data.action === 'fill' || data.action === 'row') {
        const start = data.action === 'fill' ? +data.position : next;
        if (!Number.isInteger(start) || start < 0 || start > 9999 || entries.some(function (entry) {
            return entry.position === start;
        })) return;
        const count = data.action === 'row' ? grid.columns || 3 : 1;
        for (let index = 0; index < count; index++) {
            const cell = newCell(false);
            entries.push({
                cell,
                position: start + index
            });
            if (!inserted) inserted = cell;
        }
        placeGridCells(grid, entries);
    } else {
        const entry = entries.find(function (item) {
            return item.cell.id === data.cell;
        });
        if (!entry) return;
        if (data.action === 'delete') placeGridCells(grid, entries.filter(function (item) {
            return item !== entry;
        }));
        else moveGridCell(grid, data.cell, entry.position + (data.action === 'left' ? -1 : 1));
    }
    changed();
    if (data.action === 'fill' && inserted) openBlockPalette(inserted.id, 'inside');
}

function tableAction(data) {
    const node = findBlock(data.id)?.node;
    if (!node || node.kind !== 'table') return;
    remember();
    node.changed = true;
    if (data.action === 'row') node.props.rows.push(Array(node.props.headers.length).fill(''));
    if (data.action === 'column' && node.props.headers.length < 50) {
        node.props.headers.push('Колонка');
        node.props.align.push('');
        for (const row of node.props.rows) row.push('');
    }
    changed();
}

function transformBlock(data) {
    const node = findBlock(data.id)?.node;
    if (!node || !['text', 'heading', 'directive'].includes(node.kind)) return;
    remember(data.id);
    if (data.kind === 'rule') {
        node.kind = 'rule';
        findBlock(data.id).nodes.splice(findBlock(data.id).index + 1, 0, newBlock('text', {
            id: data.newId,
            markdown: ''
        }));
    }
    if (data.kind === 'heading') {
        node.kind = 'heading';
        node.level = data.level;
        node.markdown = data.markdown;
    }
    if (data.kind === 'caption') {
        node.kind = 'directive';
        node.directive_type = 'caption';
        node.props = {
            text: data.markdown
        };
        node.changed = true;
    }
    if (data.kind === 'list') {
        node.kind = 'list';
        node.props = {
            ordered: Boolean(data.ordered),
            items: [{
                text: data.markdown,
                indent: 0,
                ordered: Boolean(data.ordered)
            }]
        };
        node.changed = true;
    }
    node.raw = '';
    changed();
}

function splitTextBlock(data) {
    const found = findBlock(data.owner || data.id);
    if (!found) return;
    remember();
    if (found.node.kind === 'list') {
        const node = found.node;
        const item = node.props.items[data.item];
        if (!item) return;
        item.text = data.before;
        node.changed = true;
        if (!data.before && !data.after && data.item === node.props.items.length - 1) {
            node.props.items.splice(data.item, 1);
            found.nodes.splice(found.index + 1, 0, newBlock('text', {
                id: data.newId,
                markdown: ''
            }));
        } else node.props.items.splice(data.item + 1, 0, {
            text: data.after,
            indent: item.indent || 0,
            ordered: item.ordered
        });
    } else if (['text', 'heading'].includes(found.node.kind)) {
        found.node.markdown = data.before;
        found.nodes.splice(found.index + 1, 0, newBlock('text', {
            id: data.newId,
            markdown: data.after
        }));
    } else return;
    changed();
}

document.getElementById('text-color-reset').addEventListener('pointerdown', function (event) {
    event.preventDefault();
});
document.getElementById('text-color-reset').addEventListener('click', function () {
    sendToFrame({
        type: 'wiki-format',
        format: 'colorReset',
        id: selectedTextId
    });
});
document.getElementById('card-color-reset').addEventListener('click', function () {
    document.getElementById('card-color').value = '';
    previewCardColor();
});

document.getElementById('flow-break').addEventListener('pointerdown', function (event) {
    event.preventDefault();
});
document.getElementById('flow-break').addEventListener('click', function () {
    pendingInsertion = null;
    contextTarget = selectedBlockId;
    contextPlacement = 'after';
    if (selectedTextId && selectedTextId === selectedBlockId) {
        palettePendingKind = 'float_break';
        sendToFrame({
            type: 'wiki-insertion-point',
            id: selectedTextId
        });
    } else addDirective('float_break');
});
