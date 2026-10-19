"use strict";
const wikiImageFallback = document.currentScript.dataset.fallback;
document.addEventListener("error", function (event) {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || image.dataset.fallbackUsed) return;
    image.dataset.fallbackUsed = "1";
    image.classList.add("image-missing");
    image.title = "Изображение не найдено";
    image.src = wikiImageFallback;
}, true);
function prepareWikiImages(root) {
    for (const image of root.querySelectorAll("img")) {
        if (!image.hasAttribute("loading")) image.loading = "lazy";
        image.decoding = "async";
    }
}
document.addEventListener("DOMContentLoaded", function () { prepareWikiImages(document); });
