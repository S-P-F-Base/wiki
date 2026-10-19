"use strict";
const wikiImageFallback = document.currentScript.dataset.fallback;
function markMissingWikiImage(image) {
    if (!(image instanceof HTMLImageElement) || image.dataset.fallbackUsed) return;
    image.dataset.fallbackUsed = "1";
    image.dataset.fallbackSource = image.getAttribute('src');
    image.classList.add("image-missing");
    image.title = "Изображение не найдено";
    image.src = wikiImageFallback;
}
document.addEventListener("error", function (event) { markMissingWikiImage(event.target); }, true);
function prepareWikiImages(root) {
    for (const image of root.querySelectorAll("img")) {
        if (!image.hasAttribute("loading")) image.loading = "lazy";
        image.decoding = "async";
        if (image.complete && image.currentSrc && !image.naturalWidth) markMissingWikiImage(image);
    }
}
document.addEventListener("DOMContentLoaded", function () { prepareWikiImages(document); });
