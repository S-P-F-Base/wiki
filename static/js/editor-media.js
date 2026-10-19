"use strict";

let mediaFolder = "";
let mediaData = {
    folders: [],
    images: []
};
let mediaSequence = 0;
let mediaObserver;
let mediaMoreObserver;
let thumbnailQueue = [];
let thumbnailActive = 0;
let mediaDuplicates = new Map();

function pumpThumbnails() {
    while (thumbnailActive < 3 && thumbnailQueue.length) {
        const item = thumbnailQueue.shift();
        if (!item.isConnected) continue;
        thumbnailActive++;
        let done = false;

        function finished() {
            if (done) return;
            done = true;
            thumbnailActive--;
            pumpThumbnails();
        }
        fetch(item.dataset.src).then(async function (response) {
            if (!response.ok) throw new Error('preview');
            const digest = response.headers.get('X-Image-Hash');
            const button = item.closest('.media-item');
            if (digest && button?.isConnected) {
                const duplicate = mediaDuplicates.get(digest);
                if (duplicate?.button.isConnected) {
                    duplicate.count++;
                    duplicate.label.textContent = duplicate.count + ' одинаковых файла';
                    duplicate.button.title += '\n' + button.title;
                    button.remove();
                    finished();
                    return;
                }
                const label = document.createElement('small');
                button.appendChild(label);
                mediaDuplicates.set(digest, {
                    button,
                    label,
                    count: 1
                });
            }
            const blob = await response.blob();
            if (!item.isConnected) {
                finished();
                return;
            }
            const url = URL.createObjectURL(blob);
            item.onload = function () {
                URL.revokeObjectURL(url);
                finished();
            };
            item.onerror = function () {
                URL.revokeObjectURL(url);
                finished();
            };
            item.src = url;
        }).catch(function () {
            item.src = '/static/images/placeholder.svg';
            finished();
        });
    }
}

function refreshMedia() {
    mediaObserver?.disconnect();
    mediaMoreObserver?.disconnect();
    thumbnailQueue = [];
    mediaDuplicates = new Map();
    const filter = document.getElementById("media-filter").value.toLowerCase();
    const grid = document.getElementById("media-grid");
    grid.replaceChildren();
    mediaObserver = new IntersectionObserver(function (entries) {
        for (const entry of entries)
            if (entry.isIntersecting) {
                mediaObserver.unobserve(entry.target);
                thumbnailQueue.push(entry.target);
            }
        pumpThumbnails();
    }, {
        root: grid,
        rootMargin: "80px"
    });
    for (const folder of mediaData.folders) {
        if (!folder.name.toLowerCase().includes(filter)) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "media-folder";
        const icon = document.createElement("span");
        icon.textContent = "▱";
        const label = document.createElement("span");
        label.textContent = folder.name;
        button.append(icon, label);
        button.addEventListener("click", function () {
            browseMedia(folder.path);
        });
        grid.appendChild(button);
    }
    const items = mediaData.images.filter(function (item) {
        return item.name.toLowerCase().includes(filter);
    });
    let offset = 0;
    const more = document.createElement("div");
    more.className = "media-more";

    function appendBatch() {
        const end = Math.min(offset + 18, items.length);
        for (; offset < end; offset++) {
            const item = items[offset];
            const button = document.createElement("button");
            button.type = "button";
            button.className = "media-item";
            button.dataset.path = item.path;
            button.setAttribute("aria-pressed", String(item.path === selectedImage));
            const image = document.createElement("img");
            image.loading = "lazy";
            image.decoding = "async";
            image.alt = "";
            image.dataset.src = "/editor/api/thumbnail?path=" + encodeURIComponent(item.path) + "&v=" + item
                .version;
            const label = document.createElement("span");
            label.textContent = item.name;
            const size = document.createElement("small");
            size.textContent = Math.round(item.bytes / 1024) + " КБ";
            button.title = item.name;
            button.append(image, label, size);
            button.addEventListener("click", function () {
                selectImage(item.path);
            });
            grid.appendChild(button);
            mediaObserver.observe(image);
        }
        if (offset < items.length) {
            more.textContent = "Ещё изображения…";
            grid.appendChild(more);
        } else more.remove();
    }
    appendBatch();
    mediaMoreObserver = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) {
            return entry.isIntersecting;
        })) appendBatch();
    }, {
        root: grid,
        rootMargin: "100px"
    });
    if (offset < items.length) mediaMoreObserver.observe(more);
    if (!grid.children.length) grid.textContent = "В этой папке нет подходящих изображений";
}

function selectImage(path) {
    selectedImage = path;
    document.getElementById("selected-image").textContent = path ? path.split("/").pop() :
        "Выбери изображение";
    document.getElementById("use-image").disabled = !path;
    for (const button of document.querySelectorAll(".media-item")) button.setAttribute("aria-pressed", String(
        button.dataset.path === path));
}
async function browseMedia(folder, recover = false) {
    const sequence = ++mediaSequence;
    document.getElementById("media-status").textContent = "Открываю папку…";
    document.getElementById("media-grid").replaceChildren();
    try {
        let result;
        let recovered = false;
        while (true) {
            try {
                result = await api('/editor/api/media?folder=' + encodeURIComponent(folder));
                break;
            } catch (error) {
                if (sequence !== mediaSequence) return;
                if (!recover || !folder || ![400, 404].includes(error.status)) throw error;
                folder = folder.split('/').slice(0, -1).join('/');
                recovered = true;
            }
        }
        if (sequence !== mediaSequence) return;
        mediaFolder = folder;
        mediaData = result;
        document.getElementById("media-filter").value = "";
        document.getElementById("upload-folder").value = folder || "uploads";
        const breadcrumbs = document.getElementById("media-breadcrumbs");
        breadcrumbs.replaceChildren();
        const parts = ["Изображения", ...folder.split("/").filter(Boolean)];
        for (let index = 0; index < parts.length; index++) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = parts[index];
            const path = parts.slice(1, index + 1).join("/");
            button.addEventListener("click", function () {
                browseMedia(path);
            });
            breadcrumbs.appendChild(button);
        }
        document.getElementById("media-status").textContent = (recovered ? 'Исходная папка не найдена. Открыта ближайшая доступная. ' : '') + result.folders.length + " папок · " + result
            .images.length + " изображений. Превью загружаются по мере прокрутки.";
        refreshMedia();
    } catch (error) {
        if (sequence !== mediaSequence) return;
        document.getElementById("media-status").textContent = error.message;
        const home = document.createElement('button');
        home.type = 'button';
        home.textContent = 'Все изображения';
        home.addEventListener('click', function () { browseMedia(''); });
        document.getElementById('media-grid').replaceChildren(home);
    }
}

function openMedia(target) {
    imageTarget = target;
    const node = target.id ? findBlock(target.id).node : null;
    selectedImage = target.settings ? target.value || "" : target.field ? readMeta()[target.field] : (node
        ?.path || "");
    document.getElementById("image-alt").value = node?.attrs.alt || "";
    document.getElementById("image-width").value = node?.attrs.width || "";
    document.getElementById("image-align").value = node?.attrs.align || "";
    const ai = document.getElementById('image-ai');
    const value = node?.attrs.ai || '';
    if (!Array.from(ai.options).some(function (option) {
        return option.value === value;
    })) ai.add(new Option(value, value));
    ai.value = value;
    document.querySelector(".image-options").hidden = Boolean(target.field || target.settings);
    selectImage(selectedImage);
    mediaDialog.showModal();
    mediaDialog.scrollTop = 0;
    document.getElementById('media-filter').focus({preventScroll: true});
    const folder = selectedImage.startsWith("images/") ? selectedImage.slice(7, selectedImage.lastIndexOf(
        "/")) : mediaFolder;
    browseMedia(folder, true);
}
document.getElementById("media-filter").addEventListener("input", refreshMedia);
document.getElementById("media-upload").addEventListener("change", async function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const status = document.getElementById("media-status");
    event.target.disabled = true;
    status.textContent = "Загружаю и проверяю сжатие…";
    try {
        if (file.size > 50 * 1024 * 1024) throw new Error("Изображение больше 50 МБ");
        const response = await fetch("/editor/api/media?filename=" + encodeURIComponent(file
            .name) + "&folder=" + encodeURIComponent(document.getElementById(
                "upload-folder")
                .value.trim()), {
            method: "POST",
            body: file
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || "Не удалось загрузить изображение");
        await browseMedia(result.path.slice(7, result.path.lastIndexOf("/")));
        selectImage(result.path);
        status.textContent = "Изображение добавлено: " + Math.round(result.bytes / 1024) +
            " КБ. Файл уже в папке проекта; страницу сохрани отдельно.";
    } catch (error) {
        status.textContent = error.message;
    } finally {
        event.target.disabled = false;
        event.target.value = "";
    }
});
document.getElementById("image-form").addEventListener("submit", function (event) {
    event.preventDefault();
    if (!selectedImage || !imageTarget) return;
    if (imageTarget.settings) {
        imageTarget.settings(selectedImage);
    } else if (imageTarget.field) {
        form.elements.namedItem(imageTarget.field).value = selectedImage;
        changed();
    } else {
        const attrs = {
            alt: document.getElementById("image-alt").value,
            width: document.getElementById("image-width").value,
            align: document.getElementById("image-align").value,
            ai: document.getElementById('image-ai').value
        };
        if (imageTarget.id) {
            remember();
            const node = findBlock(imageTarget.id).node;
            node.path = selectedImage;
            node.attrs = Object.assign({}, node.attrs, attrs);
            for (const key of Object.keys(node.attrs))
                if (!node.attrs[key]) delete node.attrs[key];
            node.changed = true;
            changed();
        } else {
            for (const key of Object.keys(attrs))
                if (!attrs[key]) delete attrs[key];
            insertBlock(newBlock("image", {
                path: selectedImage,
                attrs,
                changed: true
            }), imageTarget.insert);
        }
    }
    mediaDialog.close();
});

mediaDialog.addEventListener('close', function () {
    thumbnailQueue = [];
    mediaObserver?.disconnect();
    mediaMoreObserver?.disconnect();
});
