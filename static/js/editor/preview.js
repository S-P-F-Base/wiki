(function () {
    const textEditor = document.getElementById('textEditor');
    const previewFrame = document.getElementById('previewFrame');

    let debounceTimer = null;

    window.WikiEditor = window.WikiEditor || {};

    async function renderPreview(markdown) {
        try {
            const resp = await fetch('/wiki/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: markdown })
            });
            if (!resp.ok) throw new Error('Render error');
            let html = (await resp.json()).html;

            const script = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (a && a.href && a.href.startsWith(window.location.origin + '/wiki/')) {
      e.preventDefault();
      var path = a.href.replace(window.location.origin + '/wiki/', '');
      window.parent.postMessage({type:'navigate', path: path}, '*');
    }
  });
})();
<\/script>`;
            html = html.replace('</body>', script + '</body>');
            previewFrame.srcdoc = html;
        } catch (e) {
            previewFrame.srcdoc = '<p style="color:red;">Ошибка превью</p>';
        }
    }

    function updatePreview() {
        const markdown = textEditor.value;
        renderPreview(markdown);
    }

    function schedulePreview() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(updatePreview, 1500);
    }

    window.WikiEditor.updatePreview = updatePreview;
    window.WikiEditor.schedulePreview = schedulePreview;

    textEditor.addEventListener('input', schedulePreview);

    document.getElementById('btnPreview').addEventListener('click', updatePreview);

    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'navigate') {
            window.WikiEditor.loadPage(e.data.path);
        }
    });
})();
