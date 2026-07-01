(function () {
    const titleEl = document.querySelector('title');
    const page = titleEl ? titleEl.textContent.replace('Редактор вики – ', '') : '';

    window.WikiEditor = window.WikiEditor || {};
    window.WikiBlocks = {};

    const textEditor = document.getElementById('textEditor');

    function insertAtCursor(text) {
        const start = textEditor.selectionStart;
        const end = textEditor.selectionEnd;
        const value = textEditor.value;
        textEditor.value = value.substring(0, start) + text + value.substring(end);
        textEditor.focus();
        textEditor.setSelectionRange(start + text.length, start + text.length);
        if (window.WikiEditor.schedulePreview) {
            window.WikiEditor.schedulePreview();
        }
    }
    window.WikiEditor.insertAtCursor = insertAtCursor;

    async function loadPageContent() {
        if (!page || page === 'undefined') {
            document.getElementById('pageStatus').textContent = 'Новая страница';
            if (window.WikiEditor.updatePreview) window.WikiEditor.updatePreview();
            return;
        }
        try {
            const resp = await fetch(`/wiki/raw/${page}`);
            if (!resp.ok) throw new Error('Not found');
            const data = await resp.json();
            textEditor.value = data.content;
            document.getElementById('pageStatus').textContent = 'Страница: ' + page;
            if (window.WikiEditor.updatePreview) window.WikiEditor.updatePreview();
        } catch (e) {
            document.getElementById('pageStatus').textContent = 'Новая страница';
            if (window.WikiEditor.updatePreview) window.WikiEditor.updatePreview();
        }
    }

    async function loadPage(pagePath) {
        try {
            const resp = await fetch(`/wiki/raw/${pagePath}`);
            if (!resp.ok) throw new Error('Not found');
            const data = await resp.json();
            textEditor.value = data.content;
            document.getElementById('pageStatus').textContent = 'Страница: ' + pagePath;
            if (window.WikiEditor.updatePreview) window.WikiEditor.updatePreview();
            history.pushState(null, '', '/wiki/edit/' + pagePath);
        } catch (err) {
            alert('Не удалось загрузить страницу: ' + pagePath);
        }
    }
    window.WikiEditor.loadPage = loadPage;

    document.getElementById('btnSave').addEventListener('click', async () => {
        const markdown = textEditor.value;
        try {
            const resp = await fetch('/wiki/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ page: page, content: markdown })
            });
            if (!resp.ok) throw new Error('Save error');
            alert('Сохранено!');
        } catch (e) {
            alert('Ошибка сохранения');
        }
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            document.getElementById('btnSave').click();
        }
    });

    const modalOverlay = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');

    function openModal(blockKey) {
        const block = window.WikiBlocks[blockKey];
        if (!block) return;

        let html = `
      <div class="modal-layout" style="display:flex; gap:20px;">
        <div class="modal-form" style="flex:1;">
          <h3>${block.title}</h3>`;

        block.fields.forEach(f => {
            const val = f.default || '';
            html += `<label>${f.label}</label>`;
            if (f.type === 'textarea') {
                html += `<textarea name="${f.name}" rows="${f.rows || 3}" class="field-input"></textarea>`;
            } else if (f.type === 'select') {
                html += `<select name="${f.name}" class="field-input">`;
                f.options.forEach(opt => {
                    html += `<option value="${opt}" ${opt == val ? 'selected' : ''}>${opt}</option>`;
                });
                html += `</select>`;
            } else {
                html += `<input type="${f.type}" name="${f.name}" value="${val}" class="field-input" ${f.required ? 'required' : ''}>`;
            }
        });

        html += `
          <div class="modal-actions">
            <button id="modalCancel">Отмена</button>
            <button id="modalSubmit">Вставить</button>
          </div>
        </div>
        <div class="modal-preview" style="flex:0 0 300px; border-left:1px solid #555; padding-left:15px;">
          <h4>Превью блока</h4>
          <div id="blockPreview" style="background:#fff; color:#222; padding:10px; border-radius:4px; min-height:100px;">
            <span style="color:#999;">Заполните поля</span>
          </div>
        </div>
      </div>`;

        modalContent.innerHTML = html;
        modalOverlay.classList.add('active');

        const inputs = modalContent.querySelectorAll('.field-input');
        let previewTimer;

        function updateBlockPreview() {
            clearTimeout(previewTimer);
            previewTimer = setTimeout(async () => {
                const data = {};
                block.fields.forEach(f => {
                    const el = modalContent.querySelector(`[name="${f.name}"]`);
                    if (el) data[f.name] = el.value;
                });
                const snippet = block.generate(data);
                try {
                    const resp = await fetch('/wiki/render', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: snippet })
                    });
                    if (resp.ok) {
                        const res = await resp.json();
                        document.getElementById('blockPreview').innerHTML = res.html;
                    }
                } catch (e) {
                    document.getElementById('blockPreview').innerHTML = '<span style="color:red;">Ошибка</span>';
                }
            }, 400);
        }

        inputs.forEach(input => {
            input.addEventListener('input', updateBlockPreview);
            if (input.tagName === 'SELECT') input.addEventListener('change', updateBlockPreview);
        });

        updateBlockPreview();

        document.getElementById('modalCancel').onclick = closeModal;
        document.getElementById('modalSubmit').onclick = () => {
            const data = {};
            block.fields.forEach(f => {
                const el = modalContent.querySelector(`[name="${f.name}"]`);
                if (el) data[f.name] = el.value;
            });
            const snippet = block.generate(data);
            insertAtCursor(snippet);
            closeModal();
        };
    }

    function closeModal() {
        modalOverlay.classList.remove('active');
    }

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    window.WikiEditor.openModal = openModal;
    window.WikiEditor.closeModal = closeModal;

    loadPageContent();
})();
