"use strict";
let footnoteJumpTimer;

function scrollToSection(hash) {
    let id;
    try {
        id = decodeURIComponent(hash.replace(/^#/, ""));
    } catch {
        return;
    }
    const section = document.getElementById(id);
    if (typeof setActiveWikiToc === "function") setActiveWikiToc(hash);
    if (section) {
        section.classList.remove('heading-flash');
        void section.offsetWidth;
        section.classList.add('heading-flash');
    }
    if (section) section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

document.addEventListener("click", function (event) {
    const sample = event.target.closest('[data-sample-kind]');
    if (sample) {
        event.preventDefault();
        event.stopImmediatePropagation();
        tellParent({
            type: 'wiki-palette-select',
            kind: sample.dataset.sampleKind
        });
        return;
    }
    if (event.target.closest('.editor-meta-tag')) {
        event.preventDefault();
        tellParent({
            type: 'wiki-metadata'
        });
        return;
    }
    const link = event.target.closest("a[href]");
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event
        .altKey) return;
    if (event.target.closest('[contenteditable="true"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
    }
    const href = link.getAttribute("href");
    if (href === "javascript:history.back()") {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.parent.postMessage({
            type: "wiki-back"
        }, "*");
        return;
    }
    if (href.startsWith("#")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (link.classList.contains('footnote-ref')) {
            clearTimeout(footnoteJumpTimer);
            if (event.detail === 1) footnoteJumpTimer = setTimeout(function () {
                scrollToSection(href);
            }, 220);
        } else scrollToSection(href);
        return;
    }
    const destination = new URL(href, document.baseURI);
    const base = new URL(document.baseURI);
    if (destination.origin === base.origin && destination.pathname === "/") destination.pathname =
        "/wiki/";
    if (destination.origin === base.origin && destination.pathname.startsWith("/wiki/")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.parent.postMessage({
            type: "wiki-navigate",
            href: destination.href
        }, "*");
    } else if (destination.protocol === "http:" || destination.protocol === "https:") {
        link.target = "_blank";
        link.rel = "noopener";
    }
}, true);
window.addEventListener("message", function (event) {
    if (event.source === window.parent && event.data?.type === "wiki-scroll" && typeof event.data
        .hash === "string") scrollToSection(event.data.hash);
});
document.addEventListener("keydown", function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        window.parent.postMessage({
            type: "wiki-save-meta"
        }, "*");
    }
});

let editorKinds = {};
let editing = null;
let editingInitial = "";
let latestSequence = 0;

function tellParent(data) {
    window.parent.postMessage(data, "*");
}

function applyKinds() {
    decorateDocument(document, editorKinds);
    for (const element of document.querySelectorAll(".content [data-editor-id]")) {
        const kind = editorKinds[element.dataset.editorId];
        if (!kind) continue;
        element.dataset.editorKind = kind;
        if (kind === "text" || kind === "heading") element.title = "Двойной щелчок: изменить текст";
    }
    for (const token of document.querySelectorAll('.editor-inline-token')) token.title = token.dataset
        .tokenKind === 'constant' ? 'Константа: ' + token.dataset.tokenValue +
    ' · двойной щелчок: настроить' : 'Засекреченный текст · двойной щелчок: изменить';
    for (const reference of document.querySelectorAll('.content sup[id^="fnref"]')) reference
        .contentEditable = 'false';
}

function escapeText(text) {
    return text.replace(/&/g, "&amp;").replace(/!/g, "&#33;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\\/g, "\\\\").replace(/([`*_~[\]])/g, "\\$1").replace(/^([#+-])(?=\s)/gm, "\\$1");
}

function inlineMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent.replaceAll("\u00a0", " "));
    if (node.nodeType !== Node.ELEMENT_NODE || node.classList.contains("wiki-link-preview-card")) return "";
    if (node.tagName === "BR") return "<br>";
    if (node.dataset.tokenKind) return '!' + node.dataset.tokenKind + '[' + node.dataset.tokenValue + ']';
    if (node.tagName === "SUP") {
        const label = node.dataset.noteLabel || node.querySelector("a.footnote-ref")?.getAttribute("href")
            ?.replace(/^#fn:/, "");
        if (label) return "[^" + label + "]";
    }
    if (node.tagName === "CODE") {
        const text = node.textContent;
        const ticks = "`".repeat(Math.max(1, ...Array.from(text.matchAll(/`+/g), function (match) {
            return match[0].length + 1;
        })));
        return ticks + " " + text + " " + ticks;
    }
    let text = "";
    for (const child of node.childNodes) text += inlineMarkdown(child);
    if (!text.replaceAll('\u200b', '').trim()) return text;
    if (node.tagName === "STRONG" || node.tagName === "B") return inlineWrap(text, '**');
    if (node.tagName === "EM" || node.tagName === "I") return inlineWrap(text, '*');
    if (["S", "STRIKE", "DEL"].includes(node.tagName) || node.classList.contains("strikethrough"))
        return inlineWrap(text, '~~');
    if (node.tagName === "SMALL") return "<small>" + text + "</small>";
    if (node.tagName === "SPAN" && node.style.color) return "[color=" + node.style.color + "]" + text +
        "[/color]";
    if (node.tagName === 'FONT' && node.hasAttribute('color')) return '[color=' + node.getAttribute('color') +
        ']' + text + '[/color]';
    if (node.tagName === "A" && !node.hasAttribute("data-wiki-autolink")) {
        const href = node.getAttribute("href") || "";
        if (!/^(https?:|mailto:|\/|#|\.\.?\/)/i.test(href)) return text;
        return "[" + text + "](" + href.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29") +
            ")";
    }
    if (["DIV", "P"].includes(node.tagName)) return text + "<br>";
    return text;
}

function inlineWrap(text, marker) {
    const leading = text.match(/^\s*/)[0],
        trailing = text.match(/\s*$/)[0];
    const content = text.slice(leading.length, text.length - trailing.length);
    return content ? leading + marker + content + marker + trailing : text;
}

function editableMarkdown(element) {
    let text = "";
    for (const child of element.childNodes) text += element.dataset.editingSource ? sourceMarkdown(child) :
        inlineMarkdown(child);
    return text.replaceAll("\u200b", "").replace(/\n+$/, "");
}

function beginEditing(id) {
    const element = document.querySelector('[data-editor-id="' + id + '"]');
    if (document.body.dataset.componentPreview || !element || !["text", "heading"].includes(editorKinds[id]))
        return;
    if (editing === element) return;
    editing?.blur();
    editing = element;
    activateSource(element);
    editingInitial = editableMarkdown(element);
    element.contentEditable = "true";
    element.spellcheck = true;
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
}

function textChanged() {
    if (!editing) return;
    const rawMarkdown = editableMarkdown(editing);
    let markdown = rawMarkdown;
    let kind, level;
    if (!editing.dataset.editorOwner) {
        const heading = /^(#{1,6})[ \t]+([\s\S]*)$/.exec(markdown);
        kind = heading ? 'heading' : 'text';
        level = heading ? heading[1].length : undefined;
        if (heading) markdown = heading[2];
        editorKinds[editing.dataset.editorId] = kind;
    }
    if (rawMarkdown !== editingInitial) {
        editingInitial = rawMarkdown;
        tellParent({
            type: "wiki-edit",
            id: editing.dataset.editorId,
            owner: editing.dataset.editorOwner,
            row: Number(editing.dataset.row),
            column: Number(editing.dataset.column),
            item: Number(editing.dataset.item),
            kind,
            level,
            caption: editing.dataset.caption,
            plainText: editing.dataset.caption ? editing.innerText : undefined,
            markdown
        });
    }
}

function insertPlainText(text) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
        if (index) fragment.appendChild(document.createElement("br"));
        fragment.appendChild(document.createTextNode(lines[index] || (index === lines.length - 1 ? '\u200b' :
            '')));
    }
    const end = fragment.lastChild;
    range.insertNode(fragment);
    if (end) {
        range.setStartAfter(end);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    textChanged();
}

document.addEventListener("dblclick", function (event) {
    clearTimeout(footnoteJumpTimer);
    if (event.target.closest('[data-editor-meta]')) {
        tellParent({
            type: 'wiki-metadata'
        });
        return;
    }
    const note = event.target.closest('.wiki-footnotes li[id^="fn:"],.footnote li[id^="fn:"]');
    if (note) {
        event.preventDefault();
        tellParent({
            type: 'wiki-footnote-settings',
            label: note.id.slice(3)
        });
        return;
    }
    const token = event.target.closest('.editor-inline-token');
    if (token) {
        event.preventDefault();
        tellParent({
            type: 'wiki-inline-token',
            kind: token.dataset.tokenKind,
            value: token.dataset.tokenValue,
            index: token.dataset.tokenIndex,
            id: token.closest('[data-editor-id]').dataset.editorId
        });
        return;
    }
    const block = event.target.closest("[data-editor-id]");
    if (block) {
        const kind = editorKinds[block.dataset.editorId];
        const type = {
            card: 'wiki-card-settings',
            directive: 'wiki-block-settings',
            grid: 'wiki-block-settings',
            image: 'wiki-image-settings',
            template: 'wiki-template-open',
            cell: 'wiki-cell-text',
            table: 'wiki-block-settings',
            list: 'wiki-block-settings'
        }[kind];
        if (type) {
            event.preventDefault();
            tellParent({
                type,
                id: block.dataset.editorId
            });
            return;
        }
    }
    if (block && ["text", "heading"].includes(editorKinds[block.dataset.editorId])) {
        event.preventDefault();
        beginEditing(block.dataset.editorId);
    }
});
document.addEventListener("contextmenu", function (event) {
    if (event.shiftKey || document.body.dataset.componentPreview) return;
    event.preventDefault();
    if (event.target.closest('[data-editor-meta]')) {
        tellParent({
            type: 'wiki-context',
            meta: true,
            x: event.clientX,
            y: event.clientY
        });
        return;
    }
    let block = event.target.closest("[data-editor-id]");
    let insert = false,
        placement = 'after';
    const container = event.target.closest('.content,.card,.wiki-grid-cell');
    const bounds = container?.getBoundingClientRect();
    const border = container?.dataset.editorId && Math.min(event.clientX - bounds.left, bounds.right -
        event.clientX, event.clientY - bounds.top, bounds.bottom - event.clientY) < 10;
    if (container && !border && (event.target === container || !block)) {
        const children = Array.from(container.children).filter(function (child) {
            return child.dataset.editorId && !child.dataset.blockOwner;
        });
        let distance = Infinity;
        for (const child of children) {
            const rect = child.getBoundingClientRect();
            const near = Math.min(Math.abs(event.clientY - rect.top), Math.abs(event.clientY - rect
                .bottom));
            if (near < distance) {
                distance = near;
                block = child;
                placement = event.clientY < (rect.top + rect.bottom) / 2 ? 'before' : 'after';
            }
        }
        insert = true;
        if (!children.length && block?.dataset.editorId === container.dataset.editorId) placement =
            'inside';
    }
    const card = event.target.closest(".card[data-editor-id]");
    const blockId = block?.dataset.editorOwner || block?.dataset.blockOwner || block?.dataset
        .editorId || "";
    const token = event.target.closest('.editor-inline-token');
    const tokenData = token ? {
        id: token.closest('[data-editor-id]').dataset.editorId,
        kind: token.dataset.tokenKind,
        value: token.dataset.tokenValue,
        index: token.dataset.tokenIndex
    } : null;
    tellParent({
        type: "wiki-context",
        token: tokenData,
        insert,
        placement,
        id: blockId,
        cardId: card?.dataset.editorId || "",
        gridId: event.target.closest('.wiki-grid[data-editor-id]')?.dataset.editorId || '',
        x: event.clientX,
        y: event.clientY
    });
});
document.addEventListener("pointerdown", function (event) {
    tellParent({
        type: "wiki-dismiss"
    });
    if (editing && !editing.contains(event.target)) editing.blur();
});
document.addEventListener("input", onEditorInput);
document.addEventListener("focusout", function (event) {
    if (event.target !== editing) return;
    textChanged();
    editing.removeAttribute("contenteditable");
    editing = null;
    tellParent({
        type: "wiki-blurred"
    });
});
document.addEventListener("paste", function (event) {
    if (!editing || !editing.contains(event.target)) return;
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    insertPlainText(editorKinds[editing.dataset.editorId] === "heading" ? text.replace(/\r?\n/g,
        " ") : text);
});
document.addEventListener("keydown", function (event) {
    if (!editing || event.isComposing) return;
    if (event.key === 'Tab' && editing.dataset.item !== undefined) {
        event.preventDefault();
        tellParent({
            type: 'wiki-list-indent',
            owner: editing.dataset.editorOwner,
            item: Number(editing.dataset.item),
            change: event.shiftKey ? -1 : 1
        });
        editing.blur();
        return;
    }
    if (event.key === "Escape") {
        event.preventDefault();
        editing.blur();
    }
    if (event.key === "Enter") {
        event.preventDefault();
        splitEditing(event);
    }
});

// Reuse elements by source ID, keeping images, scroll and an active text selection.
function morphChildren(live, desired) {
    const keyed = new Map();
    for (const node of live.children)
        if (node.dataset.editorId) keyed.set(node.dataset.editorId, node);
    let cursor = live.firstChild;
    for (const incoming of Array.from(desired.childNodes)) {
        const key = incoming.nodeType === Node.ELEMENT_NODE ? incoming.dataset.editorId : "";
        let existing = key ? keyed.get(key) : cursor;
        if (!key && existing?.nodeType === Node.ELEMENT_NODE && existing.dataset.editorId) existing = null;
        if (!existing || existing.nodeType !== incoming.nodeType || existing.nodeName !== incoming.nodeName) {
            existing = incoming.cloneNode(true);
            live.insertBefore(existing, cursor);
        } else {
            if (existing !== cursor) live.insertBefore(existing, cursor);
            if (existing.nodeType === Node.TEXT_NODE) {
                if (existing.textContent !== incoming.textContent) existing.textContent = incoming
                    .textContent;
            } else if (existing === editing) {
                if (incoming.id) existing.id = incoming.id;
            } else {
                const missing = existing.nodeName === 'IMG' && existing.dataset.fallbackSource === incoming
                    .getAttribute('src');
                if (existing.nodeName === 'IMG' && existing.dataset.fallbackSource && !missing) {
                    delete existing.dataset.fallbackSource;
                    delete existing.dataset.fallbackUsed;
                }
                for (const attr of Array.from(existing.attributes)) {
                    if (!incoming.hasAttribute(attr.name) && !["data-editor-kind", "title",
                        "data-fallback-source", "data-fallback-used", "loading", "decoding"
                    ].includes(attr.name)) existing.removeAttribute(attr.name);
                }
                for (const attr of incoming.attributes)
                    if (!(missing && attr.name === 'src') && existing.getAttribute(attr.name) !== attr.value)
                        existing.setAttribute(attr.name, attr.value);
                morphChildren(existing, incoming);
            }
        }
        cursor = existing.nextSibling;
    }
    while (cursor) {
        const next = cursor.nextSibling;
        if (!cursor.classList?.contains('editor-cell-label') && !cursor.classList?.contains(
            'editor-cell-add')) cursor.remove();
        cursor = next;
    }
}
window.addEventListener("message", function (event) {
    if (event.source !== window.parent || !event.data) return;
    const data = event.data;
    if (data.type === "wiki-kinds") {
        editorKinds = data.kinds;
        latestSequence = data.sequence;
        applyKinds();
    }
    if (data.type === "wiki-focus" && typeof data.id === "string" && /^[\w-]+$/.test(data.id)) {
        const target = document.querySelector('[data-editor-id="' + data.id + '"]');
        target?.scrollIntoView({
            block: 'nearest'
        });
        beginEditing(data.id);
    }
    if (data.type === "wiki-blur") editing?.blur();
    if (data.type === 'wiki-card-color' && /^[\w-]+$/.test(data.id)) {
        const card = document.querySelector('.card[data-editor-id="' + data.id + '"]');
        if (card) {
            if (data.color) card.style.setProperty('--card-accent', data.color);
            else card.style.removeProperty('--card-accent');
        }
    }
    if (data.type !== "wiki-patch" || typeof data.html !== "string" || data.sequence < latestSequence)
        return;
    latestSequence = data.sequence;
    const desired = document.createElement('div');
    desired.innerHTML = data.html;
    data.kinds = data.kinds || {};
    if (!desired.querySelector('.toc')) {
        document.querySelector('.toc-panel .toc-inner')?.remove();
        document.querySelector('.toc-panel')?.classList.add('toc-empty');
    }
    decorateDocument(desired, data.kinds);
    const scrollX = window.scrollX,
        scrollY = window.scrollY;
    morphChildren(document.querySelector('.content'), desired);
    if ('header' in data && document.querySelector('.page > .header')) {
        const header = document.createElement('div');
        header.innerHTML = data.header;
        morphChildren(document.querySelector('.page > .header'), header.firstElementChild || document
            .createElement('div'));
    }
    if (data.base) document.querySelector('base').href = data.base;
    if ('background' in data) {
        if (data.background) document.body.style.setProperty('--wiki-bg-image', 'url(' + JSON
            .stringify(data.background) + ')');
        else document.body.style.removeProperty('--wiki-bg-image');
    }
    if (data.title) document.title = data.title;
    document.body.toggleAttribute('data-editor-template', Boolean(data.template));
    editorKinds = data.kinds;
    applyKinds();
    initWikiToc();
    if (typeof prepareWikiImages === "function") prepareWikiImages(document);
    window.scrollTo(scrollX, scrollY);
    tellParent({
        type: "wiki-patched"
    });
});

let rememberedRange = null;
let rememberedTextId = "";
document.addEventListener("selectionchange", function () {
    const selection = window.getSelection();
    if (!editing || !selection.rangeCount || !editing.contains(selection.anchorNode)) return;
    rememberedRange = selection.getRangeAt(0).cloneRange();
    rememberedTextId = editing.dataset.editorId;
    tellParent({
        type: "wiki-selection",
        id: rememberedTextId,
        owner: editing.dataset.editorOwner,
        text: selection.toString()
    });
});

function restoreEditing(id) {
    const target = document.querySelector('[data-editor-id="' + id + '"]');
    if (!target || !["text", "heading"].includes(editorKinds[id])) return false;
    if (editing !== target) {
        editing?.blur();
        editing = target;
        activateSource(target);
        editingInitial = editableMarkdown(target);
        target.contentEditable = "true";
        target.focus();
    }
    const selection = window.getSelection();
    if (rememberedRange && rememberedTextId === id && target.contains(rememberedRange
        .commonAncestorContainer)) {
        selection.removeAllRanges();
        selection.addRange(rememberedRange);
    } else {
        const range = document.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    const range = selection.getRangeAt(0);
    const anchor = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer : range
        .startContainer.parentElement;
    const atomic = anchor.closest('.editor-inline-token, sup[id^="fnref"]');
    if (atomic && target.contains(atomic) && range.collapsed) {
        range.setStartAfter(atomic);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    return true;
}
window.addEventListener("message", function (event) {
    if (event.source !== window.parent || !event.data) return;
    const data = event.data;
    if (!["wiki-format", "wiki-note"].includes(data.type) || !restoreEditing(data.id)) return;
    if (data.type === "wiki-format") {
        if (editing.dataset.editingSource && sourceFormat(data.format)) {
            textChanged();
            return;
        }
        if (data.format === 'colorReset') resetTextColor();
        if (["bold", "italic", "strikeThrough"].includes(data.format)) document.execCommand(data
            .format);
        if (data.format === 'color' && /^#[0-9a-f]{6}$/i.test(data.value)) document.execCommand(
            'foreColor', false, data.value);
        if (data.format === "small") {
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE ? range
                .commonAncestorContainer : range.commonAncestorContainer.parentElement;
            const small = container.closest("small");
            if (small && editing.contains(small)) small.replaceWith(...small.childNodes);
            else {
                const wrapper = document.createElement("small");
                wrapper.appendChild(range.extractContents());
                if (!wrapper.textContent) wrapper.textContent = "\u200b";
                range.insertNode(wrapper);
                range.selectNodeContents(wrapper);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    } else {
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        if (editing.dataset.editingSource) {
            const token = document.createTextNode('[^' + data.label + ']');
            range.deleteContents();
            range.insertNode(token);
            range.setStartAfter(token);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            textChanged();
            return;
        }
        const sup = document.createElement("sup");
        sup.dataset.noteLabel = data.label;
        sup.textContent = data.label;
        sup.contentEditable = "false";
        range.deleteContents();
        range.insertNode(sup);
        range.setStartAfter(sup);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    textChanged();
});
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") tellParent({
        type: "wiki-escape"
    });
    if (editing && (event.ctrlKey || event.metaKey) && ["b", "i"].includes(event.key.toLowerCase())) {
        event.preventDefault();
        if (!editing.dataset.editingSource || !sourceFormat(event.key.toLowerCase() === 'b' ? 'bold' :
            'italic')) document.execCommand(event.key.toLowerCase() === 'b' ? 'bold' : 'italic');
        textChanged();
    }
});

function loadEditorLinkPreview(link) {
    for (const image of link.querySelectorAll('img[data-src]')) {
        image.src = image.dataset.src;
        image.removeAttribute('data-src');
        image.dataset.loaded = '1';
    }
}
for (const type of ['pointerover', 'focusin']) document.addEventListener(type, function (event) {
    const link = event.target.closest('.wiki-link-preview-trigger');
    if (link) loadEditorLinkPreview(link);
});
document.addEventListener('click', function (event) {
    const badge = event.target.closest('.wiki-image-ai-badge');
    if (badge) {
        event.preventDefault();
        event.stopImmediatePropagation();
        badge.closest('.wiki-image-ai-wrapper').classList.toggle('is-open');
    }
}, true);
window.addEventListener('message', function (event) {
    if (event.source !== window.parent || event.data?.type !== 'wiki-token') return;
    const data = event.data;
    if (!['constant', 'redact'].includes(data.kind) || !restoreEditing(data.id)) return;
    const token = document.createElement('span');
    token.className = 'editor-inline-token';
    token.contentEditable = 'false';
    token.dataset.tokenKind = data.kind;
    token.dataset.tokenValue = data.value;
    token.dataset.tokenIndex = data.index ?? String(Date.now());
    token.textContent = data.kind === 'constant' ? data.display || 'Константа: ' + data.value : data
        .value.replace(/\S/g, '█');
    const existing = data.index == null ? null : Array.from(editing.querySelectorAll(
        '.editor-inline-token')).find(function (item) {
            return item.dataset.tokenIndex === data.index;
        });
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    if (existing) existing.replaceWith(token);
    else {
        range.deleteContents();
        range.insertNode(token);
    }
    range.setStartAfter(token);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    textChanged();
});

window.addEventListener('message', function (event) {
    if (event.source !== window.parent || event.data?.type !== 'wiki-remove-token' || !restoreEditing(
        event.data.id)) return;
    const token = Array.from(editing.querySelectorAll('.editor-inline-token')).find(function (item) {
        return item.dataset.tokenIndex === event.data.index;
    });
    token?.remove();
    textChanged();
});

function editorButton(text, attributes, title = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.title = title;
    Object.assign(button.dataset, attributes);
    return button;
}

function decorateDocument(root, kinds) {
    if (document.body.dataset.componentPreview) return;
    for (const table of root.querySelectorAll('table[data-editor-id]')) {
        const owner = table.dataset.editorId;
        if (kinds[owner] !== 'table') continue;
        const rows = Array.from(table.rows);
        for (const [rowIndex, row] of rows.entries())
            for (const [column, cell] of Array.from(row.cells).entries()) {
                const id = owner + '-r' + rowIndex + 'c' + column;
                cell.dataset.editorId = id;
                cell.dataset.editorOwner = owner;
                cell.dataset.row = String(rowIndex - 1);
                cell.dataset.column = String(column);
                kinds[id] = 'text';
            }
        if (!table.previousElementSibling?.classList.contains('editor-table-tools')) {
            const tools = document.createElement('div');
            tools.className = 'editor-table-tools';
            tools.dataset.editorId = owner + '-tools';
            tools.dataset.blockOwner = owner;
            tools.append(editorButton('＋ Строка', {
                tableAction: 'row',
                tableId: owner
            }), editorButton('＋ Колонка', {
                tableAction: 'column',
                tableId: owner
            }), editorButton('Настройки', {
                openBlock: owner
            }));
            table.before(tools);
        }
    }
    for (const list of root.querySelectorAll('ul[data-editor-id],ol[data-editor-id]')) {
        const owner = list.dataset.editorId;
        if (kinds[owner] !== 'list') continue;
        for (const [index, item] of Array.from(list.querySelectorAll('li')).entries()) {
            let text = item.querySelector(':scope > .editor-list-text');
            if (!text) {
                text = document.createElement('span');
                text.className = 'editor-list-text';
                while (item.firstChild && !['UL', 'OL'].includes(item.firstChild.nodeName)) text.appendChild(
                    item.firstChild);
                item.prepend(text);
            }
            const id = owner + '-item-' + index;
            text.dataset.editorId = id;
            text.dataset.editorOwner = owner;
            text.dataset.item = String(index);
            kinds[id] = 'text';
        }
    }
    for (const card of root.querySelectorAll('.card[data-editor-id]')) {
        const owner = card.dataset.editorId;
        if (kinds[owner] !== 'card' || card.querySelector(':scope > .editor-card-tools')) continue;
        const tools = document.createElement('div');
        tools.className = 'editor-card-tools';
        tools.dataset.editorId = owner + '-tools';
        tools.dataset.blockOwner = owner;
        tools.append(editorButton('Карточка: цвет', {
            cardSettings: owner
        }), editorButton('＋ Блок внутрь', {
            addInside: owner
        }));
        card.prepend(tools);
    }
    for (const grid of root.querySelectorAll('.wiki-grid[data-editor-id]')) {
        const owner = grid.dataset.editorId;
        if (kinds[owner] !== 'grid') continue;
        if (!grid.previousElementSibling?.classList.contains('editor-grid-tools')) {
            const tools = document.createElement('div');
            tools.className = 'editor-grid-tools';
            tools.dataset.editorId = owner + '-tools';
            tools.dataset.blockOwner = owner;
            const label = document.createElement('label');
            label.textContent = 'Колонки: ';
            const select = document.createElement('select');
            select.dataset.gridAction = 'columns';
            select.dataset.gridId = owner;
            const count = grid.style.getPropertyValue('--grid-cols') || grid.style.getPropertyValue(
                '--cols') || '3';
            for (let number = 1; number <= 24; number++) select.add(new Option(String(number), String(number),
                number === +count, number === +count));
            const styleColumns = grid.style.cssText.match(/(?:cols|columns)\s*:\s*(\d+)/);
            select.value = styleColumns?.[1] || count;
            label.appendChild(select);
            tools.append(label, editorButton('＋ Ячейка', {
                gridAction: 'add',
                gridId: owner
            }), editorButton('＋ Ряд', {
                gridAction: 'row',
                gridId: owner
            }), editorButton('Настройки', {
                gridAction: 'settings',
                gridId: owner
            }));
            grid.before(tools);
        }
        const cells = Array.from(grid.children).filter(function (element) {
            return element.classList.contains('wiki-grid-cell');
        });
        const columns = +(grid.style.getPropertyValue('--grid-cols') || 3);
        const occupied = new Set();
        for (const cell of cells) {
            const position = (+cell.style.gridRowStart - 1) * columns + +cell.style.gridColumnStart - 1;
            occupied.add(position);
            const content = Array.from(cell.children).filter(function (child) {
                return !child.matches('.editor-cell-tools,.editor-cell-label');
            });
            cell.classList.toggle('editor-button-cell', content.length === 1 &&
                (content[0].matches('.wiki-button') || content[0].matches(
                    '.editor-managed-block:has(> .wiki-button)')));
            cell.querySelector(':scope > .editor-cell-add')?.remove();
            let label = cell.querySelector(
                ':scope > .editor-cell-label,:scope > .editor-cell-tools > .editor-cell-label');
            if (!label) {
                label = document.createElement('span');
                label.className = 'editor-cell-label';
                cell.appendChild(label);
            }
            label.textContent = 'Ячейка ' + (position + 1);
            if (!cell.querySelector(':scope > .editor-cell-tools')) {
                const tools = document.createElement('span');
                tools.className = 'editor-cell-tools';
                tools.dataset.editorId = cell.dataset.editorId + '-tools';
                tools.dataset.blockOwner = cell.dataset.editorId;
                tools.append(editorButton('←', {
                    gridAction: 'left',
                    gridId: owner,
                    cellId: cell.dataset.editorId
                }, 'Переместить ячейку влево'), editorButton('→', {
                    gridAction: 'right',
                    gridId: owner,
                    cellId: cell.dataset.editorId
                }, 'Переместить ячейку вправо'), editorButton('＋', {
                    addInside: cell.dataset.editorId
                }, 'Добавить блок в ячейку'), editorButton('×', {
                    gridAction: 'delete',
                    gridId: owner,
                    cellId: cell.dataset.editorId
                }, 'Удалить ячейку'));
                tools.prepend(label);
                cell.prepend(tools);
            }
            cell.querySelector('[data-grid-action=left]').disabled = position === 0;
        }
        for (const hole of grid.querySelectorAll(':scope > .editor-grid-hole')) hole.remove();
        const last = occupied.size ? Math.max(...occupied) : -1;
        const end = Math.max(columns, Math.ceil((last + 1) / columns) * columns);
        let holes = 0;
        for (let position = 0; position < end && holes < 120; position++) {
            if (occupied.has(position)) continue;
            holes++;
            const button = editorButton('＋', {
                gridAction: 'fill',
                gridId: owner,
                position: String(position)
            }, 'Добавить блок в пустую ячейку ' + (position + 1));
            button.className = 'editor-grid-hole';
            button.dataset.editorId = owner + '-gap-' + position;
            button.dataset.blockOwner = owner;
            button.style.gridColumn = String(position % columns + 1);
            button.style.gridRow = String(Math.floor(position / columns) + 1);
            grid.appendChild(button);
        }
    }
    for (const wrapper of root.querySelectorAll('.editor-managed-block')) {
        const label = wrapper.querySelector(':scope > .editor-block-label');
        if (label?.textContent === 'Разрыв') {
            wrapper.classList.add('editor-flow-break');
            label.textContent = '↵';
            wrapper.title = 'Следующий блок начнётся под изображением';
            wrapper.setAttribute('aria-label', wrapper.title);
        }
        if (label?.textContent === 'Мелкий текст') {
            const text = wrapper.querySelector('.small-text');
            if (text) {
                text.dataset.editorId = wrapper.dataset.editorId + '-caption';
                text.dataset.editorOwner = wrapper.dataset.editorId;
                text.dataset.caption = 'true';
                kinds[text.dataset.editorId] = 'text';
            }
        }
        if (wrapper.textContent.includes('Шаблон не найден') || wrapper.querySelector(
            '.template-error, .missing')) wrapper.classList.add('editor-missing');
    }
}

function editorUiAction(event) {
    const button = event.target.closest(
        '[data-grid-action],[data-add-inside],[data-table-action],[data-open-block],[data-card-settings]');
    if (!button) return;
    event.stopImmediatePropagation();
    if (button.dataset.cardSettings) tellParent({
        type: 'wiki-card-settings',
        id: button.dataset.cardSettings
    });
    if (button.dataset.gridAction) tellParent({
        type: 'wiki-grid-action',
        grid: button.dataset.gridId,
        cell: button.dataset.cellId,
        action: button.dataset.gridAction,
        value: button.value,
        position: button.dataset.position
    });
    if (button.dataset.addInside) tellParent({
        type: 'wiki-add-palette',
        id: button.dataset.addInside,
        placement: 'inside'
    });
    if (button.dataset.tableAction) tellParent({
        type: 'wiki-table-action',
        id: button.dataset.tableId,
        action: button.dataset.tableAction
    });
    if (button.dataset.openBlock) tellParent({
        type: 'wiki-block-settings',
        id: button.dataset.openBlock
    });
}
document.addEventListener('click', function (event) {
    if (event.target.tagName !== 'SELECT') editorUiAction(event);
});
document.addEventListener('change', editorUiAction);

function caretAtEnd(element) {
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

function shortcutBlock(event) {
    if (!editing || event.isComposing || event.inputType !== 'insertText' || event.data !== ' ' || editing
        .dataset.editorOwner) return;
    const prefix = editing.textContent.replaceAll('\u200b', '');
    const heading = /^(#{1,6})$/.exec(prefix);
    const list = /^([-*]|\d+\.)$/.exec(prefix);
    if (!heading && !list && prefix !== '-#') return;
    event.preventDefault();
    const id = editing.dataset.editorId;
    editing.textContent = '';
    if (heading) {
        const replacement = document.createElement('h' + heading[1].length);
        replacement.dataset.editorId = id;
        replacement.dataset.editorKind = 'heading';
        replacement.contentEditable = 'true';
        editing.replaceWith(replacement);
        editing = replacement;
        editorKinds[id] = 'heading';
        replacement.dataset.editingSource = 'true';
        replacement.textContent = heading[1] + ' ';
        tellParent({
            type: 'wiki-transform',
            id,
            kind: 'heading',
            level: heading[1].length,
            markdown: ''
        });
    } else if (list) {
        const ordered = /\d/.test(list[1]);
        const root = document.createElement(ordered ? 'ol' : 'ul');
        root.dataset.editorId = id;
        const item = document.createElement('li'),
            text = document.createElement('span');
        text.className = 'editor-list-text';
        text.dataset.editorId = id + '-item-0';
        text.dataset.editorOwner = id;
        text.dataset.item = '0';
        text.contentEditable = 'true';
        item.appendChild(text);
        root.appendChild(item);
        editing.replaceWith(root);
        editing = text;
        editorKinds[id] = 'list';
        editorKinds[text.dataset.editorId] = 'text';
        tellParent({
            type: 'wiki-transform',
            id,
            kind: 'list',
            ordered,
            markdown: ''
        });
    } else {
        const wrapper = document.createElement('section');
        wrapper.className = 'editor-managed-block';
        wrapper.dataset.editorId = id;
        const label = document.createElement('div');
        label.className = 'editor-block-label';
        label.contentEditable = 'false';
        label.textContent = 'Мелкий текст';
        const text = document.createElement('div');
        text.className = 'small-text';
        text.dataset.editorId = id + '-caption';
        text.dataset.editorOwner = id;
        text.dataset.caption = 'true';
        text.contentEditable = 'true';
        wrapper.append(label, text);
        editing.replaceWith(wrapper);
        editing = text;
        editorKinds[id] = 'directive';
        editorKinds[text.dataset.editorId] = 'text';
        tellParent({
            type: 'wiki-transform',
            id,
            kind: 'caption',
            markdown: ''
        });
    }
    editing.dataset.editingSource = 'true';
    editingInitial = editableMarkdown(editing);
    caretAtEnd(editing);
}

function inlineShortcuts() {
    const selection = window.getSelection();
    if (!editing || !selection.rangeCount || !selection.isCollapsed) return;
    const range = selection.getRangeAt(0),
        node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !editing.contains(node) || node.parentElement.closest(
        'code,.editor-inline-token')) return;
    const text = node.textContent.slice(0, range.startOffset);
    const match = /(^|\s)(\*\*|~~|\*)(\S(?:.*?\S)?)\2$/.exec(text);
    if (!match || /[*~]/.test(match[3])) return;
    const start = match.index + match[1].length;
    const tag = match[2] === '**' ? 'strong' : match[2] === '~~' ? 's' : 'em';
    const wrapper = document.createElement(tag);
    wrapper.textContent = match[3];
    range.setStart(node, start);
    range.deleteContents();
    range.insertNode(wrapper);
    const after = document.createTextNode('\u200b');
    wrapper.after(after);
    range.setStart(after, 1);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
}

function onEditorInput() {
    if (!editing?.dataset.editingSource) inlineShortcuts();
    textChanged();
}
document.addEventListener('beforeinput', shortcutBlock);

function splitEditing(event) {
    if (event.shiftKey || editing.dataset.column !== undefined || editing.dataset.caption) {
        insertPlainText('\n');
        return;
    }
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    const before = document.createRange();
    before.selectNodeContents(editing);
    before.setEnd(range.startContainer, range.startOffset);
    const after = document.createRange();
    after.selectNodeContents(editing);
    after.setStart(range.endContainer, range.endOffset);
    const beforeBox = document.createElement('span');
    beforeBox.dataset.editingSource = editing.dataset.editingSource || '';
    beforeBox.appendChild(before.cloneContents());
    const afterBox = document.createElement('span');
    afterBox.dataset.editingSource = editing.dataset.editingSource || '';
    afterBox.appendChild(after.cloneContents());
    let first = editableMarkdown(beforeBox);
    if (editorKinds[editing.dataset.editorId] === 'heading') first = first.replace(/^#{1,6}\s/, '');
    const second = editableMarkdown(afterBox);
    if (first === '\\-\\-\\-' || first === '---') {
        const id = editing.dataset.editorId;
        const newId = crypto.randomUUID().replaceAll('-', '');
        const paragraph = document.createElement('p');
        paragraph.dataset.editorId = newId;
        paragraph.dataset.editorKind = 'text';
        paragraph.contentEditable = 'true';
        const rule = document.createElement('hr');
        rule.dataset.editorId = id;
        editing.replaceWith(rule, paragraph);
        editing = paragraph;
        editingInitial = '';
        paragraph.dataset.editingSource = 'true';
        editorKinds[id] = 'rule';
        editorKinds[newId] = 'text';
        tellParent({
            type: 'wiki-transform',
            id,
            kind: 'rule',
            newId
        });
        caretAtEnd(paragraph);
        return;
    }
    let next;
    if (editing.dataset.item !== undefined) {
        const owner = editing.dataset.editorOwner,
            index = Number(editing.dataset.item);
        const listRoot = editing.closest('ul[data-editor-id],ol[data-editor-id]');
        const empty = !first && !second && index === listRoot.querySelectorAll('.editor-list-text').length -
            1;
        if (empty) {
            next = document.createElement('p');
            next.dataset.editorId = crypto.randomUUID().replaceAll('-', '');
            editing.closest('ul[data-editor-id],ol[data-editor-id]').after(next);
        } else {
            const item = document.createElement('li');
            next = document.createElement('span');
            next.className = 'editor-list-text';
            next.dataset.editorId = owner + '-item-' + (index + 1);
            next.dataset.editorOwner = owner;
            next.dataset.item = String(index + 1);
            item.appendChild(next);
            editing.closest('li').after(item);
            // Shift IDs before the preview arrives, so continued typing targets the new item.
            const root = editing.closest('ul[data-editor-id],ol[data-editor-id]');
            let position = 0;
            for (const text of root.querySelectorAll('.editor-list-text')) {
                text.dataset.item = String(position);
                text.dataset.editorId = owner + '-item-' + position++;
                editorKinds[text.dataset.editorId] = 'text';
            }
        }
        tellParent({
            type: 'wiki-split-block',
            owner,
            item: index,
            before: first,
            after: second,
            newId: next.dataset.editorId
        });
        if (empty) editing.closest('li').remove();
    } else {
        next = document.createElement('p');
        next.dataset.editorId = crypto.randomUUID().replaceAll('-', '');
        editing.after(next);
        tellParent({
            type: 'wiki-split-block',
            id: editing.dataset.editorId,
            before: first,
            after: second,
            newId: next.dataset.editorId
        });
    }
    // Keep writing immediately, without waiting for the server render.
    if (editing?.isConnected) editing.replaceChildren(...beforeBox.childNodes);
    next.replaceChildren(...afterBox.childNodes);
    editing?.removeAttribute('contenteditable');
    editing = next;
    editingInitial = second;
    editorKinds[next.dataset.editorId] = 'text';
    next.contentEditable = 'true';
    next.dataset.editingSource = 'true';
    caretAtEnd(next);
}

window.addEventListener('message', function (event) {
    if (event.source !== window.parent || event.data?.type !== 'wiki-insertion-point' || !
        restoreEditing(event.data.id)) return;
    const range = window.getSelection().getRangeAt(0),
        before = document.createRange(),
        after = document.createRange();
    before.selectNodeContents(editing);
    before.setEnd(range.startContainer, range.startOffset);
    after.selectNodeContents(editing);
    after.setStart(range.endContainer, range.endOffset);
    const first = document.createElement('span'),
        last = document.createElement('span');
    first.dataset.editingSource = 'true';
    last.dataset.editingSource = 'true';
    first.appendChild(before.cloneContents());
    last.appendChild(after.cloneContents());
    let prefix = editableMarkdown(first);
    if (editorKinds[editing.dataset.editorId] === 'heading') prefix = prefix.replace(/^#{1,6}\s/, '');
    tellParent({
        type: 'wiki-insertion-point',
        id: editing.dataset.editorId,
        before: prefix,
        after: editableMarkdown(last)
    });
});
