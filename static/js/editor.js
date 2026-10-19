"use strict";

const navigation = document.getElementById("pages");
const frame = document.getElementById("page-view");
const form = document.getElementById("metadata-form");
const fields = document.getElementById("metadata-fields");
const panel = document.getElementById("metadata-panel");
const saveButton = document.getElementById("save");
const resetButton = document.getElementById("reset");
const statusLine = document.getElementById("status");
const metaKeys = ["title", "author", "background", "buttonimage", "buttondesc", "aitext", "aiart"];
let pages = [];
let templatePages = [];
let navigationMode = 'pages';
let pageFolders = [];
let pendingInsertion = null;
let current = null;
let savedMeta = {};
let busy = false;
let loading = false;
let loadSequence = 0;
let previewSequence = 0;
let previewTimer;
let previewRequest;
let targetHash = "";
let savedBlocks = "[]";
let blocksDirty = false;
let blocksVersion = 0;
let undoStack = [];
let lastEdit = "";
let frameReady = false;
let contextTarget = "";
let imageTarget = null;
let selectedImage = "";
let cardTarget = "";
let contextPlacement = "inside";
let selectedTextId = "";
let selectedBlockId = '';
let selectedText = '';
const menu = document.getElementById("context-menu");
const mediaDialog = document.getElementById("media-dialog");
const cardDialog = document.getElementById("card-dialog");

function setStatus(message, error = false) {
    statusLine.textContent = message;
    statusLine.classList.toggle("error", error);
}

async function api(url, data) {
    const options = {
        cache: "no-store"
    };
    if (data !== undefined) {
        options.method = "POST";
        options.headers = {
            "Content-Type": "application/json"
        };
        options.body = JSON.stringify(data);
    }
    const response = await fetch(url, options);
    if (!response.ok) {
        let message = `Ошибка запроса (${response.status})`;
        try {
            const body = await response.json();
            if (typeof body.detail === "string") message = body.detail;
        } catch {
            /* Keep the HTTP status when no JSON is available. */
        }
        const error = new Error(message);
        error.status = response.status;
        throw error;
    }
    return response.json();
}

function readMeta() {
    const meta = {};
    for (const key of metaKeys) meta[key] = form.elements.namedItem(key).value.trim();
    return meta;
}

function fillMeta(meta) {
    for (const key of metaKeys) {
        const input = form.elements.namedItem(key);
        const value = meta[key] || "";
        if (input.tagName === "SELECT" && !Array.from(input.options).some(function (option) {
            return option.value === value;
        })) {
            input.add(new Option(value, value));
        }
        input.value = value;
    }
    savedMeta = readMeta();
    updateImageLabels();
}

function isDirty() {
    const meta = readMeta();
    return current && (blocksDirty || metaKeys.some(function (key) {
        return meta[key] !== savedMeta[key];
    }));
}

function updateControls() {
    fields.disabled = !current || busy || loading;
    document.getElementById("delete-page").disabled = !current || busy || loading;
    saveButton.disabled = !current || busy || loading || !isDirty();
    resetButton.disabled = saveButton.disabled;
    document.getElementById("undo").disabled = busy || loading || !undoStack.length;
    for (const id of ["toc-toggle", "notes-button", "flow-break"]) document.getElementById(id).disabled = !
        current ||
        busy || loading;
    document.getElementById("toc-toggle").setAttribute("aria-pressed", String(Boolean(current && allBlocks()
        .some(function (node) {
            return node.kind === "toc";
        }))));
}

function setPanel(open) {
    if (open && (!current || loading || current.path.startsWith('_tech/template/'))) return;
    if (open && !panel.open) {
        panel.showModal();
        form.elements.namedItem('title').focus();
    } else if (!open && panel.open) panel.close();
}

function fillNavigation() {
    const filter = document.getElementById("filter").value.toLowerCase();
    navigation.replaceChildren();
    const folders = new Map([
        ["", navigation]
    ]);
    const entries = navigationMode === 'templates' ? templatePages : pages;
    const currentPath = current ? (navigationMode === 'templates' ? current.path.replace(/^_tech\/template\//,
        '') : current.path) : '';
    const ordered = [];
    const home = entries.find(function (page) {
        return page.path === "index.md";
    });
    if (home) ordered.push(home);
    for (const page of entries)
        if (page !== home) ordered.push(page);
    for (const page of ordered) {
        if (!(page.title + " " + page.path + " " + page.url).toLowerCase().includes(filter)) continue;
        const navPath = page.navPath || page.path;
        const parts = navPath.split("/");
        parts.pop();
        let parentPath = "";
        for (const part of parts) {
            const path = parentPath ? parentPath + "/" + part : part;
            if (!folders.has(path)) {
                const folder = document.createElement("details");
                folder.open = Boolean(filter) || currentPath.startsWith(path + "/");
                const label = document.createElement("summary");
                const index = entries.find(function (entry) {
                    return (entry.navPath || entry.path) === path + "/index.md";
                });
                label.textContent = index?.title || part;
                if (index?.title && index.title !== part) {
                    const hint = document.createElement("small");
                    hint.textContent = part;
                    label.appendChild(hint);
                }
                label.title = (navigationMode === 'templates' ? 'Шаблоны/' : 'wiki/') + path + "/";
                const children = document.createElement("div");
                folder.append(label, children);
                folders.get(parentPath).appendChild(folder);
                folders.set(path, children);
            }
            parentPath = path;
        }
        const link = document.createElement("a");
        link.className = "page-link";
        link.href = "/editor?page=" + encodeURIComponent(page.path);
        link.dataset.path = page.path;
        link.title = "wiki/" + page.path;
        if (current && current.path === page.path) link.setAttribute("aria-current", "page");
        const title = document.createElement("span");
        title.textContent = page.title;
        const route = document.createElement("span");
        route.className = "route";
        route.textContent = page.url;
        const trail = document.createElement("span");
        trail.className = "page-trail";
        trail.textContent = navPath.split("/").slice(0, -1).map(function (part, index, parents) {
            const prefix = parents.slice(0, index + 1).join("/");
            return entries.find(function (entry) {
                return entry.path === prefix + "/index.md";
            })?.title || part;
        }).join(" › ");
        link.append(title, trail, route);
        folders.get(parentPath).appendChild(link);
    }
    if (!navigation.children.length) {
        const empty = document.createElement("p");
        empty.className = "empty-navigation";
        empty.textContent = navigationMode === 'templates' ? 'Шаблоны не найдены' : 'Страницы не найдены';
        navigation.appendChild(empty);
    }
}

function updateAddress(replace = false) {
    const url = new URL(window.location.href);
    url.searchParams.set("page", current.path);
    if (replace) window.history.replaceState(null, "", url);
    else window.history.pushState(null, "", url);
}

async function openPage(path, replace = false, hash = "", discard = false) {
    if (busy) return;
    if (!discard && isDirty() && !window.confirm("Изменения ещё не сохранены. Перейти без сохранения?")) {
        updateAddress(true);
        return;
    }
    if (typeof closeTextColor === 'function') closeTextColor();
    const sequence = ++loadSequence;
    ++previewSequence;
    if (previewRequest) previewRequest.abort();
    clearTimeout(previewTimer);
    loading = true;
    updateControls();
    setStatus("Открываю страницу…");
    try {
        const data = await api("/editor/api/page?path=" + encodeURIComponent(path));
        if (sequence !== loadSequence) return;
        await setNavigationMode(data.path.startsWith('_tech/template/') ? 'templates' : 'pages');
        if (sequence !== loadSequence) return;
        current = data;
        selectedTextId = '';
        selectedText = '';
        for (const button of document.querySelectorAll(
            '[data-format], #redact-text, #constant-text, #text-color, #text-color-reset')) button
                .disabled = true;
        savedBlocks = JSON.stringify(data.blocks);
        blocksDirty = false;
        blocksVersion = 0;
        undoStack = [];
        lastEdit = "";
        selectedBlockId = "";
        pendingInsertion = null;
        fillMeta(data.meta);
        targetHash = hash;
        const templateName = data.path.startsWith('_tech/template/') ? data.path.slice(15, -3) : '';
        document.getElementById("page-title").textContent = templateName ? 'Шаблон: ' + templateName :
            data.meta.title || data.path;
        document.getElementById("file-path").textContent = "wiki/" + data.path;
        const link = document.getElementById("page-url");
        link.hidden = Boolean(templateName);
        link.href = data.url;
        link.textContent = data.url + " ↗";
        updateAddress(replace);
        fillNavigation();
        document.getElementById('delete-page').textContent = templateName ? 'Удалить шаблон' :
            'Удалить страницу';
        setStatus("ПКМ: добавить или настроить блок · Двойной щелчок: изменить текст");
        updatePreview();
    } catch (error) {
        if (sequence === loadSequence) setStatus(error.message, true);
    } finally {
        if (sequence === loadSequence) {
            loading = false;
            updateControls();
        }
    }
}

async function updatePreview() {
    clearTimeout(previewTimer);
    if (!current) return;
    const sequence = ++previewSequence;
    if (previewRequest) previewRequest.abort();
    previewRequest = new AbortController();
    try {
        const response = await fetch("/editor/api/preview", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(draft()),
            signal: previewRequest.signal
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(typeof error.detail === "string" ? error.detail :
                "Не удалось показать страницу");
        }
        const result = await response.json();
        if (sequence === previewSequence) patchPreview(frame, {
            ...result,
            kinds: blockKinds(),
            sequence
        }, false);
    } catch (error) {
        if (error.name !== "AbortError" && sequence === previewSequence) setStatus(error.message, true);
    }
}

async function savePage() {
    if (!current || busy || loading || !form.reportValidity() || !isDirty()) return;
    const payload = draft();
    const submittedBlocks = JSON.stringify(current.blocks);
    const submittedVersion = blocksVersion;
    busy = true;
    updateControls();
    setStatus("Сохраняю страницу…");
    try {
        const result = await api("/editor/api/save", payload);
        current.meta = result.meta;
        current.revision = result.revision;
        savedMeta = payload.meta;
        savedBlocks = submittedBlocks;
        blocksDirty = blocksVersion !== submittedVersion;
        const page = pages.find(function (item) {
            return item.path === current.path;
        });
        if (page) page.title = result.meta.title || current.path;
        document.getElementById("page-title").textContent = current.path.startsWith('_tech/template/') ?
            'Шаблон: ' + current.path.slice(15, -3) : page ? page.title : current.path;
        fillNavigation();
        setStatus(isDirty() ? "Сохранено. Есть новые изменения" : "Страница сохранена");
        updatePreview();
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        busy = false;
        updateControls();
    }
}

function resolvePageUrl(href) {
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/wiki/")) return null;
    let path;
    try {
        path = decodeURIComponent(url.pathname.slice(6));
    } catch {
        return null;
    }
    const candidates = path.endsWith("/") || !path ? [path + "index.md"] : [path + ".md", path + "/index.md"];
    const page = pages.find(function (item) {
        return candidates.includes(item.path);
    });
    return page ? {
        path: page.path,
        hash: url.hash
    } : null;
}

navigation.addEventListener("click", function (event) {
    const link = event.target.closest("a[data-path]");
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !==
        0) return;
    event.preventDefault();
    openPage(link.dataset.path);
});
document.getElementById("filter").addEventListener("input", fillNavigation);
document.getElementById("close-metadata").addEventListener("click", function () {
    setPanel(false);
});
form.addEventListener("submit", function (event) {
    event.preventDefault();
    savePage();
});
form.addEventListener("input", changed);
saveButton.addEventListener("click", savePage);
resetButton.addEventListener("click", function () {
    current.blocks = JSON.parse(savedBlocks);
    blocksDirty = false;
    blocksVersion++;
    undoStack = [];
    fillMeta(current.meta);
    setStatus("Изменения отменены");
    updateControls();
    updatePreview();
});
frame.addEventListener("load", function () {
    frameReady = true;
});
window.addEventListener("message", function (event) {
    if (event.source !== frame.contentWindow || !event.data || !current) return;
    const data = event.data;
    if (data.type === 'wiki-blurred') {
        if (typeof textColorPanel !== 'undefined' && !textColorPanel.hidden) return;
        updatePreview();
        return;
    }
    if (data.type === 'wiki-metadata') {
        setPanel(true);
        return;
    }
    if (data.type === "wiki-save-meta") {
        savePage();
        return;
    }
    if (data.type === "wiki-back") {
        window.history.back();
        return;
    }
    if (data.type === "wiki-context") {
        showContext(data);
        return;
    }
    if (data.type === 'wiki-add-palette') {
        openBlockPalette(data.id, data.placement || 'inside');
        return;
    }
    if (data.type === 'wiki-block-settings') {
        openBlock(data.id);
        return;
    }
    if (data.type === 'wiki-footnote-settings') {
        openNotes(data.label);
        return;
    }
    if (data.type === 'wiki-card-settings') {
        openCard(data.id);
        return;
    }
    if (data.type === 'wiki-image-settings') {
        openMedia({
            id: data.id
        });
        return;
    }
    if (data.type === 'wiki-template-open') {
        const found = findBlock(data.id);
        if (found) openPage('_tech/template/' + found.node.path + '.md');
        return;
    }
    if (data.type === 'wiki-cell-text') {
        contextPlacement = 'inside';
        insertBlock(newBlock('text', {
            markdown: 'Новый текст'
        }), data.id);
        return;
    }
    if (data.type === 'wiki-inline-token') {
        openInlineToken(data.kind, data);
        return;
    }
    if (data.type === "wiki-dismiss") {
        menu.hidden = true;
        setPanel(false);
        return;
    }
    if (data.type === "wiki-escape") {
        menu.hidden = true;
        setPanel(false);
        return;
    }
    if (data.type === "wiki-selection") {
        selectedTextId = data.id || "";
        selectedBlockId = data.owner || selectedTextId;
        selectedText = data.text || '';
        for (const button of document.querySelectorAll(
            "[data-format], #redact-text, #constant-text, #text-color, #text-color-reset")) button
                .disabled = !
                selectedTextId;
        document.getElementById('text-color').disabled = !selectedTextId || !selectedText;
        return;
    }
    if (data.type === 'wiki-grid-action') {
        gridAction(data);
        return;
    }
    if (data.type === 'wiki-table-action') {
        tableAction(data);
        return;
    }
    if (data.type === 'wiki-transform') {
        transformBlock(data);
        return;
    }
    if (data.type === 'wiki-split-block') {
        splitTextBlock(data);
        return;
    }
    if (data.type === 'wiki-list-indent') {
        const node = findBlock(data.owner)?.node;
        if (node?.kind !== 'list') return;
        const item = node.props.items[data.item];
        if (!item) return;
        remember();
        const previous = data.item > 0 ? node.props.items[data.item - 1].indent || 0 : -1;
        item.indent = Math.max(0, Math.min(previous + 1, (item.indent || 0) + data.change));
        node.changed = true;
        changed();
        pendingFocus = data.owner + '-item-' + data.item;
        return;
    }
    if (data.type === "wiki-edit") {
        if (data.owner) {
            const owner = findBlock(data.owner)?.node;
            if (owner?.kind === 'directive' && owner.directive_type === 'caption') {
                remember(data.owner);
                owner.props.text = data.plainText;
                owner.props.markdown = data.markdown;
                owner.changed = true;
                changed(!data.deferPreview);
                return;
            }
            if (!owner || !['list', 'table'].includes(owner.kind) || typeof data.markdown !==
                'string') return;
            remember(data.owner);
            if (owner.kind === 'table') {
                const row = data.row < 0 ? owner.props.headers : owner.props.rows[data.row];
                if (!row || data.column < 0 || data.column >= row.length) return;
                row[data.column] = data.markdown;
            } else {
                const item = owner.props.items[data.item];
                if (!item) return;
                item.text = data.markdown;
            }
            owner.changed = true;
            changed(!data.deferPreview);
            return;
        }
        const found = findBlock(data.id);
        if (!found || !["text", "heading"].includes(found.node.kind) || typeof data.markdown !==
            "string") return;
        remember(data.id);
        found.node.markdown = data.markdown;
        if (data.kind && ["text", "heading"].includes(data.kind)) {
            found.node.kind = data.kind;
            if (data.level) found.node.level = data.level;
        }
        changed(!data.deferPreview);
        return;
    }
    if (data.type === "wiki-navigate" && typeof data.href === "string") {
        const page = resolvePageUrl(data.href);
        if (page) openPage(page.path, false, page.hash);
        else setStatus("Страница по этому пути не найдена в локальной вики", true);
    }
});
window.addEventListener("popstate", function () {
    const path = new URL(window.location.href).searchParams.get("page") || "index.md";
    openPage(path, true);
});
document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        savePage();
    }
    if (event.key === "Escape") {
        if (!mediaDialog.open) setPanel(false);
        menu.hidden = true;
    }
});
window.addEventListener("beforeunload", function (event) {
    if (isDirty()) {
        event.preventDefault();
        event.returnValue = "";
    }
});

function draft() {
    return {
        path: current.path,
        meta: readMeta(),
        revision: current.revision,
        blocks: current.blocks
    };
}

function sendToFrame(message) {
    frame.contentWindow.postMessage(message, "*");
}

function updateImageLabels() {
    for (const key of ["background", "buttonimage"]) {
        const value = form.elements.namedItem(key).value;
        document.getElementById(key + "-name").textContent = value ? value.split("/").pop() : "Не выбрано";
    }
}

function changed(render = true) {
    updateImageLabels();
    ++previewSequence;
    if (previewRequest) previewRequest.abort();
    setStatus(isDirty() ? "Есть несохранённые изменения · Ctrl+S: сохранить" : "Все изменения сохранены");
    updateControls();
    clearTimeout(previewTimer);
    if (render === false) return;
    if (document.getElementById('block-dialog').open) {
        scheduleBlockPreview();
        return;
    }
    previewTimer = setTimeout(updatePreview, 180);
}

function findBlock(id, nodes = current.blocks, parent = null) {
    for (let index = 0; index < nodes.length; index++) {
        const node = nodes[index];
        if (node.id === id) return {
            node,
            nodes,
            index,
            parent
        };
        const child = findBlock(id, node.children || [], node);
        if (child) return child;
    }
    return null;
}

function blockKinds(nodes = current.blocks, result = {}) {
    for (const node of nodes) {
        if (node.kind !== "raw") result[node.id] = node.kind;
        blockKinds(node.children || [], result);
    }
    return result;
}

function remember(editId = "") {
    blocksDirty = true;
    blocksVersion++;
    if (!editId || lastEdit !== editId) {
        undoStack.push(JSON.stringify(current.blocks));
        if (undoStack.length > 50) undoStack.shift();
    }
    lastEdit = editId;
}

function newBlock(kind, values = {}) {
    return Object.assign({
        id: crypto.randomUUID().replaceAll("-", ""),
        kind,
        children: []
    }, values);
}

function insertBlock(node, target = contextTarget) {
    remember();
    if (pendingInsertion) {
        const point = pendingInsertion;
        pendingInsertion = null;
        const anchor = findBlock(point.id);
        if (anchor) {
            target = point.id;
            if (point.before && point.after) {
                anchor.node.markdown = point.before;
                anchor.nodes.splice(anchor.index + 1, 0, newBlock('text', {
                    markdown: point.after
                }));
                contextPlacement = 'after';
            } else contextPlacement = point.before ? 'after' : 'before';
        }
    }
    const found = findBlock(target);
    if (found && contextPlacement === "inside" && ["card", "grid", "cell"].includes(found.node.kind)) {
        if (found.node.kind === 'grid') {
            if (!found.node.children.length) found.node.children.push(newCell(false));
            found.node.children[found.node.children.length - 1].children.push(node);
        } else found.node.children.push(node);
    } else if (found?.node.kind === 'cell') {
        const grid = found.parent;
        const entries = gridEntries(grid);
        const anchor = entries.find(function (entry) {
            return entry.cell.id === target;
        });
        const position = anchor.position + (contextPlacement === 'before' ? 0 : 1);
        for (const entry of entries)
            if (entry.position >= position) entry.position++;
        const cell = newCell(false);
        cell.children.push(node);
        entries.push({
            cell,
            position
        });
        placeGridCells(grid, entries);
    } else if (found) found.nodes.splice(found.index + (contextPlacement === "before" ? 0 : 1), 0, node);
    else current.blocks.push(node);
    changed();
    // Focus is applied after the next preview patch, when the element exists.
    pendingFocus = node.kind === "card" ? node.children[0].id : node.id;
}
let pendingFocus = "";

function menuAction(label, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "menuitem");
    button.textContent = label;
    button.addEventListener("click", function () {
        menu.hidden = true;
        action();
    });
    menu.appendChild(button);
}

let menuAnchor = {
    x: 0,
    y: 0
};

function fitContextMenu() {
    if (menu.hidden) return;
    menu.style.maxHeight = Math.max(120, window.innerHeight - 16) + "px";
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(menuAnchor.x, window.innerWidth - rect.width - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(menuAnchor.y, window.innerHeight - rect.height - 8)) + "px";
}
new ResizeObserver(fitContextMenu).observe(menu);
window.addEventListener('resize', fitContextMenu);

function showContext(data) {
    if (busy || loading) return;
    contextTarget = typeof data.id === "string" ? data.id : "";
    contextPlacement = data.placement || "inside";
    const found = findBlock(contextTarget);
    selectedBlockId = contextTarget;
    menu.replaceChildren();
    if (data.insert) {
        menuAction("Добавить блок здесь…", function () {
            openBlockPalette(contextTarget, contextPlacement);
        });
    } else if (data.meta) {
        menuAction("Изменить метаданные", function () {
            setPanel(true);
        });
    } else
        if (data.token) {
            menuAction("Изменить", function () {
                openInlineToken(data.token.kind, {
                    id: contextTarget,
                    ...data.token
                });
            });
            menuAction("Удалить", function () {
                sendToFrame({
                    type: 'wiki-remove-token',
                    id: data.token.id || contextTarget,
                    index: data.token.index
                });
            });
        } else if (found) {
            menuAction("Изменить", function () {
                if (["text", "heading"].includes(found.node.kind)) sendToFrame({
                    type: "wiki-focus",
                    id: found.node.id
                });
                else if (found.node.kind === "card") openCard(found.node.id);
                else if (found.node.kind === "image") openMedia({
                    id: found.node.id
                });
                else if (found.node.kind === "template") openPage("_tech/template/" + found.node.path +
                    ".md");
                else if (found.node.kind === "cell") openBlock(found.parent.id);
                else openBlock(found.node.id);
            });
            menuAction("Удалить", function () {
                remember();
                found.nodes.splice(found.index, 1);
                if (found.node.kind === "cell" && found.index === 0 && found.nodes.length) found.nodes[0]
                    .opening = "";
                changed();
            });
            if (["card", "grid", "cell"].includes(found.node.kind)) menuAction("Добавить внутрь…", function () {
                openBlockPalette(found.node.id, "inside");
            });
            if (found.parent) menuAction("Внешний блок…", function () {
                showContext({
                    id: found.parent.id,
                    x: data.x,
                    y: data.y
                });
            });
        } else menuAction("Добавить блок…", function () {
            openBlockPalette("", "after");
        });
    menu.hidden = false;
    const rect = frame.getBoundingClientRect();
    menuAnchor = {
        x: rect.left + (data.x || 0),
        y: rect.top + (data.y || 0)
    };
    fitContextMenu();
    menu.querySelector("button")?.focus();
}

function openCard(id) {
    cardTarget = id;
    const color = id ? findBlock(id).node.color : "#ff9800";
    document.getElementById("card-color").value = color;
    cardColorPicker.setColor(color || '#ff9800');
    cardDialog.showModal();
}

function previewCardColor() {
    const color = document.getElementById("card-color").value.trim();
    if (cardTarget && !cardTarget.startsWith("after:") && (!color || CSS.supports("color", color))) {
        const found = findBlock(cardTarget);
        if (found) {
            remember("color:" + cardTarget);
            found.node.color = color;
            changed(false);
            sendToFrame({
                type: 'wiki-card-color',
                id: cardTarget,
                color
            });
        }
    }
}
document.getElementById("card-color").addEventListener("input", previewCardColor);
cardDialog.addEventListener('close', function () {
    if (cardDialog.dataset.colorSampling) return;
    updatePreview();
});
document.getElementById("card-color").addEventListener("input", function (event) {
    event.target.setCustomValidity("");
});
document.getElementById("card-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const input = document.getElementById("card-color");
    const color = input.value.trim();
    input.setCustomValidity(color && !CSS.supports("color", color) ?
        "Укажи цвет: например #ff9800 или orange" : "");
    if (!input.reportValidity()) return;
    if (!cardTarget || cardTarget.startsWith("after:")) {
        const node = newBlock("card", {
            color,
            closing: "\n\n!card_end\n\n",
            children: [newBlock("text", {
                markdown: "Текст карточки"
            })]
        });
        if (cardTarget.startsWith("after:")) {
            const found = findBlock(cardTarget.slice(6));
            remember();
            found.nodes.splice(found.index + 1, 0, node);
            changed();
            pendingFocus = node.children[0].id;
        } else insertBlock(node);
    } else previewCardColor();
    lastEdit = "";
    cardDialog.close();
});

document.addEventListener("click", function (event) {
    if (!menu.contains(event.target)) menu.hidden = true;
    if (event.target.closest("[data-close-dialog]")) event.target.closest("dialog").close();
    const choose = event.target.closest("[data-media-field]");
    if (choose) openMedia({
        field: choose.dataset.mediaField
    });
    const clear = event.target.closest("[data-clear-field]");
    if (clear) {
        form.elements.namedItem(clear.dataset.clearField).value = "";
        changed();
    }
});
document.getElementById("undo").addEventListener("click", function () {
    if (!undoStack.length) return;
    current.blocks = JSON.parse(undoStack.pop());
    lastEdit = "";
    blocksDirty = JSON.stringify(current.blocks) !== savedBlocks;
    changed();
    sendToFrame({
        type: "wiki-blur"
    });
});
window.addEventListener("message", function (event) {
    if (event.source !== frame.contentWindow || event.data?.type !== "wiki-patched") return;
    if (targetHash) {
        sendToFrame({
            type: "wiki-scroll",
            hash: targetHash
        });
        targetHash = "";
    }
    if (pendingFocus) {
        sendToFrame({
            type: "wiki-focus",
            id: pendingFocus
        });
        pendingFocus = "";
    }
});

function allBlocks(nodes = current?.blocks || [], result = []) {
    for (const node of nodes) {
        result.push(node);
        allBlocks(node.children || [], result);
    }
    return result;
}
document.getElementById("toc-toggle").addEventListener("click", function () {
    remember();
    const toc = allBlocks().filter(function (node) {
        return node.kind === "toc";
    });
    if (toc.length)
        for (const node of toc) {
            const found = findBlock(node.id);
            found.nodes.splice(found.index, 1);
        }
    else current.blocks.unshift(newBlock("toc"));
    changed();
});
for (const button of document.querySelectorAll("[data-format]")) {
    button.addEventListener("pointerdown", function (event) {
        event.preventDefault();
    });
    button.addEventListener("click", function () {
        sendToFrame({
            type: "wiki-format",
            format: button.dataset.format,
            id: selectedTextId
        });
    });
}

function fillNotes() {
    const list = document.getElementById("notes-list");
    list.replaceChildren();
    const notes = allBlocks().filter(function (node) {
        return node.kind === "footnote";
    });
    for (const note of notes) {
        const row = document.createElement("section");
        row.className = "note-entry";
        row.dataset.noteLabel = note.label;
        const title = document.createElement("strong");
        title.textContent = "Сноска " + note.label;
        const input = document.createElement("textarea");
        input.rows = 3;
        input.value = note.markdown ?? note.note_text;
        input.setAttribute("aria-label", "Текст сноски " + note.label);
        input.addEventListener("input", function () {
            remember("note:" + note.id);
            note.markdown = input.value;
            changed();
        });
        const insert = document.createElement("button");
        insert.type = "button";
        insert.textContent = "Вставить ссылку в текст";
        insert.disabled = !selectedTextId;
        insert.addEventListener("click", function () {
            document.getElementById("notes-dialog").close();
            sendToFrame({
                type: "wiki-note",
                id: selectedTextId,
                label: note.label
            });
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Удалить";
        remove.addEventListener("click", function () {
            if (!window.confirm("Удалить сноску и ссылки на неё?")) return;
            remember();
            const found = findBlock(note.id);
            found.nodes.splice(found.index, 1);
            for (const node of allBlocks()) {
                if (node.markdown != null) node.markdown = node.markdown.replaceAll("[^" + note
                    .label + "]", "");
                if (node.raw && !/^\s*```|^\s*~~~/m.test(node.raw)) node.raw = node.raw.replaceAll(
                    "[^" + note.label + "]", "");
            }
            changed();
            fillNotes();
        });
        row.append(title, input, insert, remove);
        list.appendChild(row);
    }
    if (!notes.length) list.textContent = "На этой странице пока нет сносок";
}
document.getElementById("notes-button").addEventListener("click", function () {
    openNotes();
});
document.getElementById("add-note").addEventListener("click", function () {
    const labels = new Set(allBlocks().filter(function (node) {
        return node.kind === "footnote";
    }).map(function (node) {
        return node.label;
    }));
    let number = 1;
    while (labels.has(String(number))) number++;
    remember();
    current.blocks.push(newBlock("footnote", {
        label: String(number),
        note_text: "",
        markdown: ""
    }));
    changed();
    fillNotes();
    document.querySelector("#notes-list .note-entry:last-child textarea")?.focus();
});

async function start() {
    try {
        const data = await api("/editor/api/pages");
        pages = data.pages;
        pageFolders = data.folders || [""];
        fillNavigation();
        const requested = new URL(window.location.href).searchParams.get("page");
        const initial = requested || (pages.some(function (page) {
            return page.path === "index.md";
        }) ? "index.md" : pages[0]?.path);
        if (initial) await openPage(initial, true);
        else setStatus("В папке wiki пока нет страниц");
    } catch (error) {
        setStatus(error.message, true);
    }
}
start();
panel.addEventListener('focusout', function () {
    requestAnimationFrame(function () {
        if (panel.open && !panel.contains(document.activeElement) && !mediaDialog.open)
            setPanel(false);
    });
});

panel.addEventListener('click', function (event) {
    if (event.target !== panel) return;
    const rect = panel.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event
        .clientY > rect.bottom) setPanel(false);
});

function openNotes(label = '') {
    fillNotes();
    document.getElementById('notes-dialog').showModal();
    const row = Array.from(document.querySelectorAll('#notes-list .note-entry')).find(function (entry) {
        return entry.dataset.noteLabel === label;
    });
    if (row) {
        row.scrollIntoView({
            block: 'nearest'
        });
        row.querySelector('textarea').focus();
    }
}
