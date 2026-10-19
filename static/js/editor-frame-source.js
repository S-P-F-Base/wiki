"use strict";

function sourceFragment(node) {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent.replace(/&/g,
        '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_~[\]])/g, '\\$1'));
    if (node.nodeType !== Node.ELEMENT_NODE || node.classList.contains('wiki-link-preview-card'))
        return document.createTextNode('');
    if (node.tagName === 'SUP') return document.createTextNode(inlineMarkdown(node));
    if (node.dataset.tokenKind || node.tagName === 'BR') return node.cloneNode(
        true);
    if (node.tagName === 'CODE') return document.createTextNode(inlineMarkdown(node));
    if (node.tagName === 'A' && !node.hasAttribute('data-wiki-autolink')) return document.createTextNode(
        inlineMarkdown(node));
    let marker = '';
    if (['B', 'STRONG'].includes(node.tagName)) marker = '**';
    if (['I', 'EM'].includes(node.tagName)) marker = '*';
    if (['S', 'STRIKE', 'DEL'].includes(node.tagName) || node.classList.contains('strikethrough')) marker =
        '~~';
    const fragment = document.createDocumentFragment();
    if (marker) fragment.appendChild(document.createTextNode(marker));
    if (node.tagName === 'SMALL') fragment.appendChild(document.createTextNode('<small>'));
    const colored = (node.tagName === 'SPAN' && node.style.color) || node.tagName === 'FONT';
    const target = colored ? node.cloneNode(false) : fragment;
    for (const child of node.childNodes) target.appendChild(sourceFragment(child));
    if (colored) fragment.appendChild(target);
    if (node.tagName === 'SMALL') fragment.appendChild(document.createTextNode('</small>'));
    if (marker) fragment.appendChild(document.createTextNode(marker));
    return fragment;
}

function activateSource(element) {
    if (element.dataset.editingSource) return;
    const fragment = document.createDocumentFragment();
    if (/^H[1-6]$/.test(element.tagName)) fragment.appendChild(document.createTextNode('#'.repeat(Number(
        element.tagName[1])) + ' '));
    for (const child of element.childNodes) fragment.appendChild(sourceFragment(child));
    element.replaceChildren(fragment);
    element.dataset.editingSource = 'true';
}

function sourceMarkdown(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    if (node.dataset.tokenKind || node.tagName === 'SUP') return inlineMarkdown(node);
    if (node.tagName === 'BR') return '<br>';
    let text = '';
    for (const child of node.childNodes) text += sourceMarkdown(child);
    const color = node.style?.color || (node.tagName === 'FONT' ? node.getAttribute('color') : '');
    return color ? '[color=' + color + ']' + text + '[/color]' : text;
}

function sourceFormat(format) {
    const markers = {
        bold: ['**', '**'],
        italic: ['*', '*'],
        strikeThrough: ['~~', '~~'],
        small: ['<small>', '</small>']
    };
    const pair = markers[format];
    if (!pair) return false;
    const selection = window.getSelection(),
        range = selection.getRangeAt(0),
        content = range.extractContents();
    const start = document.createTextNode(pair[0]),
        end = document.createTextNode(pair[1]);
    const fragment = document.createDocumentFragment();
    fragment.append(start, content, end);
    range.insertNode(fragment);
    range.setStartAfter(start);
    range.setEndBefore(end);
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
}

function resetTextColor() {
    const selection = window.getSelection();
    if (!selection.isCollapsed) document.execCommand('removeFormat');
    else {
        const anchor = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection
            .anchorNode.parentElement;
        const colored = anchor.closest('span[style],font[color]');
        const elements = colored && editing.contains(colored) ? [colored] : Array.from(editing
            .querySelectorAll('span[style],font[color]'));
        for (const element of elements) {
            element.style.removeProperty('color');
            element.removeAttribute('color');
        }
    }
}
