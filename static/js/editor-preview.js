"use strict";
// Each preview owns one styled shell. Updates contain only rendered fragments.
const previewFrames = new WeakMap();

function patchPreview(target, payload, component = true) {
    let state = previewFrames.get(target);
    if (!state) {
        state = {
            ready: false,
            pending: null
        };
        previewFrames.set(target, state);
        target.classList.add('preview-loading');
        target.addEventListener('load', function () {
            state.ready = true;
            target.classList.remove('preview-loading');
            if (state.pending) {
                target.contentWindow.postMessage(state.pending, '*');
                state.pending = null;
            }
        });
        target.src = '/editor/frame' + (component ? '?component=true' : '');
    }
    const message = {
        ...payload,
        type: 'wiki-patch'
    };
    if (state.ready) target.contentWindow.postMessage(message, '*');
    else state.pending = message;
}
