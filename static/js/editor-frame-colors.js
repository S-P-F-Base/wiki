"use strict";

let samplingPageColor = false;

function startTextColor(id) {
    const target = document.querySelector('[data-editor-id="' + id + '"]');
    if (!target || !['text', 'heading'].includes(editorKinds[id])) return;
    if (editing === target) rememberSelectionOffsets();
    const offsets = rememberedTextId === id ? rememberedOffsets : null;
    if (!offsets || offsets.start === offsets.end) return;
    editing = target;
    activateSource(target);
    editingInitial = editableMarkdown(target);
    target.contentEditable = 'true';
    const prefix = /^#{1,6}\s/.exec(target.textContent);
    const selection = {
        start: offsets.start,
        end: offsets.end
    };
    if (prefix && editorKinds[id] === 'heading') selection.start = Math.max(prefix[0].length, selection
    .start);
    textColorSession = {
        id,
        offsets: selection
    };
    const range = rangeAtTextOffsets(target, selection);
    const anchor = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement :
        range.startContainer;
    tellParent({
        type: 'wiki-color-state',
        id,
        color: getComputedStyle(anchor).color
    });
}

function applyTextColor(value) {
    if (!textColorSession || !/^#[\da-f]{6}$/i.test(value) || editing?.dataset.editorId !== textColorSession
        .id) return;
    const range = rangeAtTextOffsets(editing, textColorSession.offsets);
    if (range.collapsed) return;
    const before = document.createRange(),
        after = document.createRange();
    before.selectNodeContents(editing);
    before.setEnd(range.startContainer, range.startOffset);
    after.selectNodeContents(editing);
    after.setStart(range.endContainer, range.endOffset);
    const prefix = before.cloneContents(),
        suffix = after.cloneContents();
    const fragment = range.cloneContents();
    for (const child of fragment.querySelectorAll('span[style],font[color]')) {
        child.style.removeProperty('color');
        child.removeAttribute('color');
        if (!child.style.length) child.removeAttribute('style');
        if (!child.attributes.length) child.replaceWith(...child.childNodes);
    }
    const wrapper = document.createElement('span');
    wrapper.className = 'editor-color-selection';
    wrapper.style.color = value;
    wrapper.appendChild(fragment);
    for (const part of [prefix, suffix])
        for (const previous of part.querySelectorAll('.editor-color-selection')) previous.classList.remove('editor-color-selection');
    for (const part of [prefix, suffix])
        for (const empty of part.querySelectorAll('span[style],font[color]'))
            if (!empty.textContent && !empty.querySelector('br')) empty.remove();
    editing.replaceChildren(prefix, wrapper, suffix);
    range.selectNodeContents(wrapper);
    rememberedRange = range.cloneRange();
    rememberedTextId = textColorSession.id;
    rememberedOffsets = textColorSession.offsets;
    textChanged();
}

function endTextColor(data) {
    if (textColorSession?.id !== data.id) return;
    rememberedOffsets = textColorSession.offsets;
    rememberedTextId = textColorSession.id;
    textColorSession = null;
    if (editing?.dataset.editorId === data.id) {
        if (data.restoreFocus) {
            editing.focus();
            restoreEditing(data.id);
        } else {
            textChanged();
            editing.removeAttribute('contenteditable');
            editing = null;
        }
    }
    tellParent({type: 'wiki-color-finished'});
}

window.addEventListener('message', function (event) {
    if (event.source !== window.parent || !event.data) return;
    const data = event.data;
    if (data.type === 'wiki-color-start') startTextColor(data.id);
    if (data.type === 'wiki-color-value' && textColorSession?.id === data.id) applyTextColor(data
        .value);
    if (data.type === 'wiki-color-end') endTextColor(data);
    if (data.type === 'wiki-color-sample-start') {
        samplingPageColor = true;
        document.documentElement.classList.add('editor-color-sampling');
    }
    if (data.type === 'wiki-color-sample-end') {
        samplingPageColor = false;
        document.documentElement.classList.remove('editor-color-sampling');
    }
});

function backgroundAt(element) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', {
        willReadFrequently: true
    });
    const parents = [];
    for (let current = element; current; current = current.parentElement) parents.push(current);
    context.fillStyle = '#101010';
    context.fillRect(0, 0, 1, 1);
    for (const parent of parents.reverse()) {
        context.fillStyle = getComputedStyle(parent).backgroundColor;
        context.fillRect(0, 0, 1, 1);
    }
    const pixel = context.getImageData(0, 0, 1, 1).data;
    return '#' + Array.from(pixel.slice(0, 3)).map(function (value) {
        return value.toString(16).padStart(2, '0');
    }).join('');
}

function samplePageColor(event) {
    const element = event.target;
    const background = backgroundAt(element);
    const image = element.closest('img');
    if (image && image.naturalWidth && image.naturalHeight) {
        const rect = image.getBoundingClientRect(),
            style = getComputedStyle(image);
        let width = rect.width,
            height = rect.height;
        if (['cover', 'contain', 'scale-down', 'none'].includes(style.objectFit)) {
            const scale = style.objectFit === 'none' ? 1 : style.objectFit === 'cover' ? Math.max(rect.width /
                image.naturalWidth, rect.height / image.naturalHeight) : Math.min(style.objectFit ===
                'scale-down' ? 1 : Infinity, rect.width / image.naturalWidth, rect.height / image
                .naturalHeight);
            width = image.naturalWidth * scale;
            height = image.naturalHeight * scale;
        }
        const position = style.objectPosition.split(' ');
        const x = (event.clientX - rect.left - (rect.width - width) * (parseFloat(position[0]) || 0) / 100) /
            width;
        const y = (event.clientY - rect.top - (rect.height - height) * (parseFloat(position[1]) || 0) / 100) /
            height;
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) return {
            image: image.currentSrc || image.src,
            x,
            y,
            background
        };
    }
    const caret = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const fallback = !caret && document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const node = caret?.offsetNode || fallback?.startContainer;
    const offset = caret?.offset ?? fallback?.startOffset;
    if (node?.nodeType === Node.TEXT_NODE && node.textContent.length) {
        const range = document.createRange();
        for (const index of [offset - 1, offset]) {
            if (index < 0 || index >= node.textContent.length || !node.textContent[index].trim()) continue;
            range.setStart(node, index);
            range.setEnd(node, index + 1);
            const rect = range.getBoundingClientRect();
            if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top &&
                event.clientY <= rect.bottom) return {color: getComputedStyle(node.parentElement).color};
        }
    }
    const bounds = element.getBoundingClientRect(),
        style = getComputedStyle(element);
    for (const [side, distance] of [
            ['Left', event.clientX - bounds.left],
            ['Right', bounds.right - event.clientX],
            ['Top', event.clientY - bounds.top],
            ['Bottom', bounds.bottom - event.clientY]
        ]) {
        if (distance < parseFloat(style['border' + side + 'Width'])) return {
            color: style['border' + side + 'Color']
        };
    }
    return {
        color: background
    };
}

for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'dblclick', 'contextmenu'])
    window.addEventListener(type, function (event) {
        if (!samplingPageColor) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (type === 'click') {
            tellParent({
                type: 'wiki-color-sampled',
                ...samplePageColor(event)
            });
            samplingPageColor = false;
            document.documentElement.classList.remove('editor-color-sampling');
        }
    }, true);
window.addEventListener('keydown', function (event) {
    if (!samplingPageColor || event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    tellParent({
        type: 'wiki-color-sample-cancel'
    });
    samplingPageColor = false;
    document.documentElement.classList.remove('editor-color-sampling');
}, true);
