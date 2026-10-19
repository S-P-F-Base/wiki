"use strict";

const colorCanvas = document.createElement('canvas');
colorCanvas.width = colorCanvas.height = 1;
const colorContext = colorCanvas.getContext('2d', {
    willReadFrequently: true
});

function rgbHex(red, green, blue) {
    return '#' + [red, green, blue].map(function (value) {
        return Math.round(value).toString(16).padStart(2, '0');
    }).join('');
}

function normalizeColor(value) {
    value = value?.trim().toLowerCase();
    if (/^#[\da-f]{6}$/.test(value)) return value;
    if (/^#[\da-f]{3}$/.test(value)) return '#' + Array.from(value.slice(1)).map(function (digit) {
        return digit + digit;
    }).join('');
    if (!value || !CSS.supports('color', value)) return null;
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = value;
    colorContext.fillRect(0, 0, 1, 1);
    return rgbHex(...colorContext.getImageData(0, 0, 1, 1).data.slice(0, 3));
}

function hsvColor(hue, saturation, value) {
    function channel(offset) {
        const part = (offset + hue / 60) % 6;
        return value * (1 - saturation * Math.max(0, Math.min(part, 4 - part, 1))) * 255;
    }
    return rgbHex(channel(5), channel(3), channel(1));
}

class EditorColorPicker {
    constructor(root, options) {
        this.root = root;
        this.options = options;
        this.hue = 0;
        root.classList.add('color-picker');
        root.innerHTML =
            '<div class="color-field" tabindex="0" role="group" aria-label="Насыщенность и яркость: меняй стрелками"><span></span></div>' +
            '<input class="color-hue" type="range" min="0" max="360" value="0" aria-label="Цветовой тон">' +
            '<div class="color-values"><label>HEX<input class="color-hex" spellcheck="false" maxlength="7" aria-label="HEX"></label>' +
            '<label>R<input type="number" min="0" max="255" aria-label="Красный"></label>' +
            '<label>G<input type="number" min="0" max="255" aria-label="Зелёный"></label>' +
            '<label>B<input type="number" min="0" max="255" aria-label="Синий"></label></div>' +
            '<div class="color-presets" aria-label="Готовые цвета"></div>' +
            '<div class="color-picker-actions"><button type="button" class="color-sample">Пипетка</button>' +
            '<button type="button" class="color-reset">Сбросить</button></div>' +
            '<p class="color-picker-status" role="status"></p>';
        this.field = root.querySelector('.color-field');
        this.thumb = this.field.firstElementChild;
        this.hueInput = root.querySelector('.color-hue');
        this.hexInput = root.querySelector('.color-hex');
        this.rgbInputs = Array.from(root.querySelectorAll('input[type=number]'));
        this.status = root.querySelector('.color-picker-status');
        this.presets = root.querySelector('.color-presets');
        for (const color of ['#ffffff', '#bbbbbb', '#777777', '#222222', '#ff5353', '#ff9800', '#ffdb4d',
                '#b8e05c',
                '#35c477', '#36d2c7', '#50bbf4', '#4e78ed', '#9772ec', '#d970db', '#ee88b3', '#ba815a'
            ]) {
            const button = document.createElement('button');
            button.type = 'button';
            button.style.backgroundColor = color;
            button.dataset.color = color;
            button.title = color;
            button.setAttribute('aria-label', 'Цвет ' + color);
            button.addEventListener('click', function () {
                this.setColor(color, true);
            }.bind(this));
            this.presets.appendChild(button);
        }
        this.field.addEventListener('pointerdown', function (event) {
            if (event.button !== 0) return;
            event.preventDefault();
            this.field.focus();
            this.field.setPointerCapture(event.pointerId);
            this.movePointer(event);
        }.bind(this));
        this.field.addEventListener('pointermove', function (event) {
            if (this.field.hasPointerCapture(event.pointerId)) this.movePointer(event);
        }.bind(this));
        this.field.addEventListener('keydown', function (event) {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const step = event.shiftKey ? .1 : .01;
            if (event.key === 'ArrowLeft') this.saturation -= step;
            if (event.key === 'ArrowRight') this.saturation += step;
            if (event.key === 'ArrowUp') this.brightness += step;
            if (event.key === 'ArrowDown') this.brightness -= step;
            this.updateHSV();
        }.bind(this));
        this.hueInput.addEventListener('input', function () {
            this.hue = +this.hueInput.value;
            this.updateHSV();
        }.bind(this));
        this.hexInput.addEventListener('input', function () {
            const value = this.hexInput.value.trim();
            this.hexInput.setAttribute('aria-invalid', String(!/^#?[\da-f]{0,6}$/i.test(value)));
            if (/^#?[\da-f]{6}$/i.test(value)) this.commitHex();
        }.bind(this));
        this.hexInput.addEventListener('change', this.commitHex.bind(this));
        for (const input of this.rgbInputs) input.addEventListener('input', function () {
            if (this.rgbInputs.every(function (item) {
                    return item.value !== '' && item.checkValidity();
                }))
                this.setColor(rgbHex(...this.rgbInputs.map(function (item) {
                    return +item.value;
                })), true);
        }.bind(this));
        root.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && event.target.tagName === 'INPUT') {
                event.preventDefault();
                if (event.target === this.hexInput) this.commitHex();
            }
        }.bind(this));
        root.querySelector('.color-reset').addEventListener('click', options.reset);
        root.querySelector('.color-sample').addEventListener('click', async function () {
            this.status.textContent = 'Выбери цвет на странице. Esc: отмена.';
            try {
                const color = await sampleWikiColor(root);
                this.setColor(color, true);
            } catch (error) {
                if (error.name !== 'AbortError') this.status.textContent = error.message;
            } finally {
                if (this.status.textContent.startsWith('Выбери цвет')) this.status
                    .textContent = '';
            }
        }.bind(this));
        this.setColor(options.initial || '#ff9800');
    }

    setColor(value, notify = false) {
        const hex = normalizeColor(value);
        if (!hex) return;
        const [red, green, blue] = [1, 3, 5].map(function (index) {
            return parseInt(hex.slice(index, index + 2), 16) / 255;
        });
        const high = Math.max(red, green, blue),
            low = Math.min(red, green, blue),
            delta = high - low;
        if (delta) this.hue = (60 * (high === red ? ((green - blue) / delta + 6) % 6 : high === green ? (
            blue - red) / delta + 2 : (red - green) / delta + 4));
        this.saturation = high ? delta / high : 0;
        this.brightness = high;
        this.draw(hex, notify);
    }

    commitHex() {
        const value = this.hexInput.value.trim();
        const valid = /^#?(?:[\da-f]{3}|[\da-f]{6})$/i.test(value);
        this.hexInput.setAttribute('aria-invalid', String(!valid));
        if (valid) this.setColor(value.startsWith('#') ? value : '#' + value, true);
    }

    movePointer(event) {
        const rect = this.field.getBoundingClientRect();
        this.saturation = (event.clientX - rect.left) / rect.width;
        this.brightness = 1 - (event.clientY - rect.top) / rect.height;
        this.updateHSV();
    }

    updateHSV() {
        this.saturation = Math.max(0, Math.min(1, this.saturation));
        this.brightness = Math.max(0, Math.min(1, this.brightness));
        this.draw(hsvColor(this.hue, this.saturation, this.brightness), true);
    }

    draw(hex, notify) {
        this.hex = hex;
        this.field.style.backgroundColor = hsvColor(this.hue, 1, 1);
        this.thumb.style.left = this.saturation * 100 + '%';
        this.thumb.style.top = (1 - this.brightness) * 100 + '%';
        this.field.setAttribute('aria-description', 'Насыщенность ' + Math.round(this.saturation * 100) +
            '%, яркость ' + Math.round(this.brightness * 100) + '%');
        this.hueInput.value = this.hue;
        this.hexInput.value = hex;
        this.hexInput.removeAttribute('aria-invalid');
        this.rgbInputs.forEach(function (input, index) {
            input.value = parseInt(hex.slice(index * 2 + 1, index * 2 + 3), 16);
        });
        for (const button of this.presets.children) button.setAttribute('aria-pressed', String(button
            .dataset.color === hex));
        this.status.textContent = '';
        if (notify) this.options.change(hex);
    }
}

const textColorPanel = document.getElementById('text-color-panel');
const textColorButton = document.getElementById('text-color');
let textColorTarget = '';
let colorSampling = null;

function closeTextColor(restoreFocus = false) {
    if (textColorPanel.hidden) return;
    colorSampling?.abort();
    textColorPanel.hidden = true;
    textColorButton.setAttribute('aria-expanded', 'false');
    sendToFrame({
        type: 'wiki-color-end',
        id: textColorTarget,
        restoreFocus
    });
    textColorTarget = '';
}

function positionTextColor() {
    if (textColorPanel.hidden) return;
    const anchor = textColorButton.getBoundingClientRect();
    const bounds = textColorPanel.getBoundingClientRect();
    textColorPanel.style.left = Math.max(8, Math.min(anchor.left, innerWidth - bounds.width - 8)) + 'px';
    textColorPanel.style.top = Math.max(8, Math.min(anchor.bottom + 6, innerHeight - bounds.height - 8)) +
        'px';
}

const textColorPicker = new EditorColorPicker(document.getElementById('text-color-picker'), {
    initial: '#ffb74d',
    change: function (value) {
        textColorButton.style.setProperty('--chosen-color', value);
        sendToFrame({
            type: 'wiki-color-value',
            id: textColorTarget,
            value
        });
    },
    reset: function () {
        const id = textColorTarget;
        closeTextColor(true);
        sendToFrame({
            type: 'wiki-format',
            format: 'colorReset',
            id
        });
    }
});
const cardColorPicker = new EditorColorPicker(document.getElementById('card-picker'), {
    change: function (value) {
        document.getElementById('card-color').value = value;
        previewCardColor();
    },
    reset: function () {
        document.getElementById('card-color-reset').click();
    }
});

textColorButton.addEventListener('pointerdown', function (event) {
    event.preventDefault();
});
textColorButton.addEventListener('click', function () {
    if (!textColorPanel.hidden) {
        closeTextColor(true);
        return;
    }
    if (!selectedTextId) return;
    lastEdit = '';
    textColorTarget = selectedTextId;
    textColorPanel.hidden = false;
    textColorButton.setAttribute('aria-expanded', 'true');
    sendToFrame({
        type: 'wiki-color-start',
        id: textColorTarget
    });
    positionTextColor();
    textColorPicker.hexInput.focus();
    textColorPicker.hexInput.select();
});
for (const button of textColorPanel.querySelectorAll('[data-color-close]')) button.addEventListener('click',
    function () {
        closeTextColor(true);
    });
document.addEventListener('pointerdown', function (event) {
    if (!colorSampling && !textColorPanel.contains(event.target) && !textColorButton.contains(event
            .target)) closeTextColor();
});
document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (colorSampling) colorSampling.abort();
    else if (!textColorPanel.hidden) {
        event.preventDefault();
        closeTextColor(true);
    }
});
window.addEventListener('resize', positionTextColor);
window.addEventListener('message', function (event) {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type === 'wiki-color-state' && event.data.id === textColorTarget) {
        textColorPicker.setColor(event.data.color);
        textColorButton.style.setProperty('--chosen-color', textColorPicker.hex);
        if (document.activeElement === textColorPicker.hexInput) textColorPicker.hexInput.select();
    }
    if (event.data?.type === 'wiki-dismiss' && !colorSampling) closeTextColor();
    if (event.data?.type === 'wiki-color-finished') updatePreview();
});
document.getElementById('cancel-color-sampling').addEventListener('click', function () {
    colorSampling?.abort();
});

async function sampleWikiColor(root) {
    if (colorSampling) throw new Error('Пипетка уже включена');
    const controller = new AbortController();
    colorSampling = controller;
    textColorPanel.style.visibility = 'hidden';
    const dialog = root.closest('dialog');
    if (dialog?.open) {
        dialog.dataset.colorSampling = 'true';
        dialog.close();
    }
    document.getElementById('color-sampling-status').hidden = false;
    try {
        const sample = await new Promise(function (resolve, reject) {
            function cleanup() {
                window.removeEventListener('message', receive);
                controller.signal.removeEventListener('abort', cancel);
            }

            function cancel() {
                cleanup();
                reject(new DOMException('Выбор отменён', 'AbortError'));
            }

            function receive(event) {
                if (event.source !== frame.contentWindow) return;
                if (event.data?.type === 'wiki-color-sample-cancel') controller.abort();
                if (event.data?.type === 'wiki-color-sampled') {
                    cleanup();
                    resolve(event.data);
                }
            }
            window.addEventListener('message', receive);
            controller.signal.addEventListener('abort', cancel, {
                once: true
            });
            sendToFrame({
                type: 'wiki-color-sample-start'
            });
        });
        if (!sample.image) return sample.color;
        const url = new URL(sample.image, location.origin);
        if (url.origin !== location.origin || !url.pathname.startsWith('/static/')) throw new Error(
            'Выбери изображение из вики');
        const response = await fetch(url, {
            signal: controller.signal
        });
        if (!response.ok) throw new Error('Не удалось прочитать картинку');
        const blobUrl = URL.createObjectURL(await response.blob());
        try {
            const image = new Image();
            image.src = blobUrl;
            await image.decode();
            colorContext.clearRect(0, 0, 1, 1);
            colorContext.drawImage(image, Math.min(image.naturalWidth - 1, Math.max(0, Math.floor(sample
                .x * image.naturalWidth))), Math.min(image.naturalHeight - 1, Math.max(0, Math
                .floor(sample.y * image.naturalHeight))), 1, 1, 0, 0, 1, 1);
            const pixel = colorContext.getImageData(0, 0, 1, 1).data;
            const background = normalizeColor(sample.background) || '#101010';
            const alpha = pixel[3] / 255;
            return rgbHex(...[0, 1, 2].map(function (index) {
                return pixel[index] * alpha + parseInt(background.slice(index * 2 + 1, index *
                    2 + 3), 16) * (1 - alpha);
            }));
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    } finally {
        sendToFrame({
            type: 'wiki-color-sample-end'
        });
        document.getElementById('color-sampling-status').hidden = true;
        colorSampling = null;
        textColorPanel.style.visibility = '';
        if (dialog?.dataset.colorSampling) {
            delete dialog.dataset.colorSampling;
            dialog.showModal();
        }
        root.querySelector('.color-sample').focus();
    }
}
