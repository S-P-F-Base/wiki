(function () {
    const textEditor = document.getElementById('textEditor');
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.display = 'none';
    document.body.appendChild(menu);

    const style = document.createElement('style');
    style.textContent = `
    .context-menu {
      position: fixed;
      background: #2d2d2d;
      border: 1px solid #555;
      border-radius: 4px;
      padding: 4px 0;
      z-index: 1500;
      min-width: 180px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    }
    .context-menu-item {
      padding: 6px 12px;
      font-size: 13px;
      cursor: pointer;
      color: #ddd;
      display: block;
      width: 100%;
      text-align: left;
      background: none;
      border: none;
    }
    .context-menu-item:hover {
      background: #555;
    }
  `;
    document.head.appendChild(style);

    function buildMenu() {
        menu.innerHTML = '';
        const blocks = window.WikiBlocks || {};
        Object.keys(blocks).forEach(key => {
            const item = document.createElement('button');
            item.className = 'context-menu-item';
            item.textContent = blocks[key].title;
            item.addEventListener('click', () => {
                hideMenu();
                window.WikiEditor.openModal(key);
            });
            menu.appendChild(item);
        });
    }

    function showMenu(x, y) {
        buildMenu();
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.style.display = 'block';
    }

    function hideMenu() {
        menu.style.display = 'none';
    }

    textEditor.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showMenu(e.clientX, e.clientY);
    });

    document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && e.target !== textEditor) {
            hideMenu();
        }
    });
})();
