(function () {
    window.WikiBlocks = window.WikiBlocks || {};
    window.WikiBlocks.button = {
        title: '🔘 Кнопка',
        fields: [
            { name: 'url', label: 'Ссылка', type: 'text', required: true },
            { name: 'name', label: 'Название', type: 'text', required: true },
            { name: 'desc', label: 'Описание (необязательно)', type: 'text' },
            { name: 'image', label: 'URL картинки (необязательно)', type: 'text' }
        ],
        generate: function (data) {
            let s = '\n!button[\n';
            s += `    ${data.url}\n    ${data.name}\n`;
            if (data.desc) s += `    ${data.desc}\n`;
            if (data.image) s += `    ${data.image}\n`;
            s += ']\n';
            return s;
        }
    };
})();
