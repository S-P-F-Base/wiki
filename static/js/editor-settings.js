"use strict";

let linkSettings = null;
let linkTab = "autolinks";
let settingsTimer;
let settingsSequence = 0;
let settingsSaved = "";
const settingsDialog = document.getElementById("links-dialog");
const settingsFrame = document.getElementById("link-preview-frame");

function settingsChanged() {
    document.getElementById("settings-status").textContent = "Настройки ещё не сохранены";
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(renderLinkExample, 250);
}

function settingsField(root, title, key, item, multiline = false) {
    field(root, title, item[key] || "", function (value) {
        item[key] = value;
        settingsChanged();
    }, null, multiline);
}

function fillLinkEntries() {
    const root = document.getElementById("link-entries");
    root.replaceChildren();
    for (const id of ["tab-autolinks", "tab-previews"]) document.getElementById(id).setAttribute(
        "aria-pressed", String(id === "tab-" + linkTab));
    const entries = linkSettings[linkTab];
    for (const [index, item] of entries.entries()) {
        const row = document.createElement("section");
        row.className = "form-entry";
        if (linkTab === "autolinks") {
            settingsField(row, "Слово или фраза", "term", item);
            settingsField(row, "Адрес страницы", "href", item);
            field(row, "Или выбрать страницу вики", item.href || "", function (value) {
                if (value) {
                    item.href = value;
                    fillLinkEntries();
                    settingsChanged();
                }
            }, [
                ["", "Страница…"], ...pages.map(function (page) {
                    return [page.url, page.title + ": " + page.path];
                })
            ]);
            field(row, "Другие варианты (через запятую)", (item.aliases || "").split("|").join(", "),
                function (value) {
                    item.aliases = value.split(",").map(function (part) {
                        return part.trim();
                    }).filter(Boolean).join("|");
                    settingsChanged();
                });
        } else {
            settingsField(row, "Адрес ссылки (если нужен)", "href", item);
            settingsField(row, "Или текст ссылки для сопоставления", "term", item);
            field(row, "Другие варианты (через запятую)", (item.terms || "").split("|").join(", "), function (
                value) {
                item.terms = value.split(",").map(function (part) {
                    return part.trim();
                }).filter(Boolean).join("|");
                settingsChanged();
            });
            settingsField(row, "Заголовок превью", "title", item);
            settingsField(row, "Описание", "synopsis", item, true);
            const label = document.createElement("p");
            label.textContent = "Изображение: " + (item.image?.split("/").pop() || "не выбрано");
            row.appendChild(label);
            action(row, "Выбрать изображение", function () {
                openMedia({
                    settings: function (path) {
                        item.image = path;
                        label.textContent = "Изображение: " + path.split("/").pop();
                        settingsChanged();
                    },
                    value: item.image
                });
            });
            action(row, "Убрать изображение", function () {
                item.image = "";
                label.textContent = "Изображение: не выбрано";
                settingsChanged();
            });
            settingsField(row, "Ширина изображения", "image_width", item);
            settingsField(row, "Высота изображения", "image_height", item);
        }
        action(row, "Проверить этот пример", function () {
            document.getElementById("link-example").value = item.term || item.title || "Ссылка";
            document.getElementById("link-example-href").value = linkTab === "previews" ? item.href ||
                "/wiki/" : "";
            settingsChanged();
        });
        action(row, "Удалить", function () {
            entries.splice(index, 1);
            fillLinkEntries();
            settingsChanged();
        });
        root.appendChild(row);
    }
    if (!entries.length) root.textContent = linkTab === "autolinks" ?
        "Автолинков пока нет. Они автоматически превращают слова в ссылки." :
        "Превью пока нет. Они показываются при наведении на ссылку.";
}

function exampleSource() {
    const text = document.getElementById("link-example").value.replace(/([\\`*_[\]])/g, "\\$1");
    const href = document.getElementById("link-example-href").value.trim();
    return href ? "[" + text + "](" + href.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29") +
        ")" : text;
}
async function renderLinkExample() {
    if (!linkSettings) return;
    const sequence = ++settingsSequence;
    try {
        const response = await fetch("/editor/api/settings/preview", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(Object.assign({}, linkSettings, {
                example: exampleSource()
            }))
        });
        if (!response.ok) {
            const body = await response.json();
            throw new Error(body.detail || "Не удалось показать пример");
        }
        const result = await response.json();
        if (sequence !== settingsSequence) return;
        patchPreview(settingsFrame, {
            ...result,
            kinds: {},
            sequence
        });
        document.getElementById("settings-status").textContent = JSON.stringify(linkSettings) ===
            settingsSaved ? "Настройки сохранены" : "Пример обновлён · Изменения ещё не сохранены";
    } catch (error) {
        if (sequence === settingsSequence) document.getElementById("settings-status").textContent = error
            .message;
    }
}
document.getElementById("links-button").addEventListener("click", async function () {
    try {
        linkSettings = await api("/editor/api/settings");
        settingsSaved = JSON.stringify(linkSettings);
        fillLinkEntries();
        settingsDialog.showModal();
        renderLinkExample();
    } catch (error) {
        setStatus(error.message, true);
    }
});
for (const tab of ["autolinks", "previews"]) document.getElementById("tab-" + tab).addEventListener("click",
    function () {
        linkTab = tab;
        fillLinkEntries();
    });
document.getElementById("add-link-entry").addEventListener("click", function () {
    linkSettings[linkTab].push(linkTab === "autolinks" ? {
        term: "",
        href: "",
        aliases: ""
    } : {
        term: "",
        href: "",
        title: "",
        image: "",
        synopsis: ""
    });
    fillLinkEntries();
    settingsChanged();
    document.querySelector("#link-entries .form-entry:last-child input")?.focus();
});
document.getElementById("link-example").addEventListener("input", settingsChanged);
document.getElementById("link-example-href").addEventListener("input", settingsChanged);
document.getElementById("save-links").addEventListener("click", async function () {
    const button = document.getElementById("save-links");
    button.disabled = true;
    try {
        const result = await api("/editor/api/settings", linkSettings);
        linkSettings.revision = result.revision;
        settingsSaved = JSON.stringify(linkSettings);
        document.getElementById("settings-status").textContent = "Настройки сохранены";
        updatePreview();
    } catch (error) {
        document.getElementById("settings-status").textContent = error.message;
    } finally {
        button.disabled = false;
    }
});
