"use strict";
let pageSlugEdited = false;
let creatingTemplate = false;

async function refreshTemplates() {
    const listing = await api('/editor/api/templates');
    templatePages = listing.templates.map(function (entry) {
        return {
            path: entry.path,
            navPath: entry.name + '.md',
            title: entry.name.split('/').pop(),
            url: 'Шаблон: ' + entry.name
        };
    });
}

async function setNavigationMode(mode) {
    if (mode === 'templates') await refreshTemplates();
    navigationMode = mode;
    document.getElementById('articles-button').setAttribute('aria-pressed', String(mode === 'pages'));
    document.getElementById('templates-button').setAttribute('aria-pressed', String(mode ===
        'templates'));
    document.getElementById('new-page').textContent = mode === 'templates' ? '＋ Новый шаблон' :
        '＋ Новая страница';
    document.getElementById('navigation-hint').hidden = mode !== 'templates';
    document.getElementById('pages').setAttribute('aria-label', mode === 'templates' ? 'Шаблоны' :
        'Страницы вики');
    fillNavigation();
}
for (const [id, mode] of [
    ['articles-button', 'pages'],
    ['templates-button', 'templates']
]) {
    document.getElementById(id).addEventListener('click', function () {
        setNavigationMode(mode).catch(function (error) {
            setStatus(error.message, true);
        });
    });
}

function folderTitle(path) {
    if (!path) return 'Главный раздел';
    const parents = path.split('/');
    return parents.map(function (part, index) {
        const prefix = parents.slice(0, index + 1).join('/');
        return pages.find(function (page) {
            return page.path === prefix + '/index.md';
        })?.title || part;
    }).join(' › ');
}

function pageAddress() {
    const title = document.getElementById('new-page-title').value;
    const slug = document.getElementById('new-page-slug');
    if (!pageSlugEdited) slug.value = title.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(
        /^-+|-+$/g, '');
    const folder = document.getElementById('new-page-folder').value;
    document.getElementById('new-page-address').textContent = (creatingTemplate ? 'Шаблон: ' : '/wiki/') + (
        folder ? folder + '/' : '') + slug.value;
}
document.getElementById('new-page').addEventListener('click', function () {
    creatingTemplate = navigationMode === 'templates';
    document.getElementById('new-page-heading').textContent = creatingTemplate ? 'Новый шаблон' :
        'Новая страница';
    document.getElementById('new-page-form').reset();
    const select = document.getElementById('new-page-folder');
    select.replaceChildren();
    const folders = creatingTemplate ? Array.from(new Set(['', ...templatePages.map(function (entry) {
        return entry.navPath.split('/').slice(0, -1).join('/');
    })])).sort() : pageFolders.length ? pageFolders : [''];
    for (const path of folders) select.add(new Option(creatingTemplate ? path || 'Все шаблоны' :
        folderTitle(path), path));
    select.value = (creatingTemplate ? current?.path.replace(/^_tech\/template\//, '') : current
        ?.path)?.split('/').slice(0, -1).join('/') || '';
    if (select.selectedIndex < 0) select.selectedIndex = 0;
    pageSlugEdited = false;
    document.getElementById('new-page-status').textContent = '';
    pageAddress();
    document.getElementById('new-page-dialog').showModal();
    document.getElementById('new-page-title').focus();
});
document.getElementById('new-page-title').addEventListener('input', pageAddress);
document.getElementById('new-page-folder').addEventListener('change', pageAddress);
document.getElementById('new-page-slug').addEventListener('input', function () {
    pageSlugEdited = true;
    pageAddress();
});
document.getElementById('new-page-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    if (isDirty() && !window.confirm(
        'Перейти к новой странице без сохранения текущих изменений?')) return;
    const button = event.submitter;
    button.disabled = true;
    try {
        const result = creatingTemplate ? await api('/editor/api/templates', {
            name: [document.getElementById('new-page-folder').value, document
                .getElementById('new-page-slug').value
            ].filter(Boolean).join('/')
        }) : await api('/editor/api/pages/create', {
            title: document.getElementById('new-page-title').value,
            folder: document.getElementById('new-page-folder').value,
            name: document.getElementById('new-page-slug').value
        });
        const listing = await api('/editor/api/pages');
        pages = listing.pages;
        pageFolders = listing.folders;
        document.getElementById('new-page-dialog').close();
        await openPage(result.path, false, '', true);
    } catch (error) {
        document.getElementById('new-page-status').textContent = error.message;
    } finally {
        button.disabled = false;
    }
});
document.getElementById('delete-page').addEventListener('click', async function () {
    if (!current || busy || loading) return;
    if (!window.confirm('Удалить страницу «' + (current.meta.title || current.path) +
        '»?\nФайл: wiki/' + current.path + (isDirty() ?
            '\nНесохранённые изменения также будут потеряны.' : ''))) return;
    busy = true;
    updateControls();
    try {
        await api('/editor/api/pages/delete', {
            path: current.path,
            revision: current.revision
        });
        current = null;
        blocksDirty = false;
        savedBlocks = '[]';
        undoStack = [];
        const listing = await api('/editor/api/pages');
        pages = listing.pages;
        pageFolders = listing.folders;
        busy = false;
        await setNavigationMode(navigationMode);
        fillMeta({});
        updateControls();
        const next = (navigationMode === 'templates' ? templatePages : pages).find(function (
            page) {
            return page.path === 'index.md';
        }) || (navigationMode === 'templates' ? templatePages[0] : pages[0]);
        if (next) await openPage(next.path, true, '', true);
        else {
            patchPreview(frame, {
                html: '',
                header: '',
                kinds: {},
                sequence: ++previewSequence
            }, false);
            setStatus('Страниц пока нет. Создай первую.');
            document.getElementById('page-title').textContent = 'Нет страниц';
        }
    } catch (error) {
        setStatus(error.message, true);
    } finally {
        busy = false;
        updateControls();
    }
});
