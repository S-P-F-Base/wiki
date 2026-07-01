(function () {
    const resizer = document.getElementById('resizer');
    if (!resizer) return;

    const leftPanel = document.querySelector('.editor-panel');
    const mainContainer = document.querySelector('.main');
    const iframe = document.getElementById('previewFrame');

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let animationFrame = null;

    function onMouseDown(e) {
        e.preventDefault();
        isResizing = true;
        startX = e.clientX;
        startWidth = leftPanel.getBoundingClientRect().width;

        iframe.style.pointerEvents = 'none';
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    function onMouseMove(e) {
        if (!isResizing) return;
        if (animationFrame) cancelAnimationFrame(animationFrame);

        animationFrame = requestAnimationFrame(() => {
            const delta = e.clientX - startX;
            let newWidth = startWidth + delta;
            const mainWidth = mainContainer.getBoundingClientRect().width;

            const minWidth = 200;
            const maxWidth = mainWidth - 200;
            newWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);

            leftPanel.style.width = newWidth + 'px';
            leftPanel.style.flex = 'none';
        });
    }

    function onMouseUp() {
        isResizing = false;
        if (animationFrame) cancelAnimationFrame(animationFrame);

        iframe.style.pointerEvents = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
    }

    resizer.addEventListener('mousedown', onMouseDown);
})();
