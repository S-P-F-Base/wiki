(function () {
    const MARQUEE_DURATION = 12000;

    function startMarquee(marEl, duration) {
        if (!marEl || marEl.dataset.started) return;
        marEl.dataset.started = '1';
        const html = marEl.innerHTML;
        marEl.innerHTML += html;
        const total = marEl.scrollWidth / 2;
        let start = null;
        function frame(ts) {
            if (!start) start = ts;
            const elapsed = ts - start;
            const pct = (elapsed % duration) / duration;
            const x = -pct * total;
            marEl.style.transform = `translateX(${x}px)`;
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    function initElement(el) {
        if (!el || el.dataset.lInit) return;
        if (el.getAttribute('data-display') !== 'block') return;
        el.dataset.lInit = '1';

        const msg = el.getAttribute('data-msg') || 'ИНФОРМАЦИЯ ЗАБЛОКИРОВАНА';
        const arrRaw = el.getAttribute('data-arr') || '';
        const arrivals = arrRaw ? arrRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

        el.classList.remove('released');
        el.classList.add('locked');

        el.innerHTML = '';

        const row = document.createElement('div');
        row.className = 'lob-row';

        const badge = document.createElement('div');
        badge.className = 'lob-badge';
        badge.textContent = 'ВНИМАНИЕ';
        row.appendChild(badge);

        const main = document.createElement('div');
        main.className = 'lob-main';

        const headline = document.createElement('div');
        headline.className = 'lob-headline';
        headline.textContent = msg;
        main.appendChild(headline);

        if (arrivals.length) {
            const arrWrap = document.createElement('div');
            arrWrap.className = 'lob-arr-wrap';
            const mar = document.createElement('div');
            mar.className = 'lob-marquee';
            arrivals.forEach(a => {
                const chip = document.createElement('div');
                chip.className = 'lob-chip';
                chip.textContent = a;

                const shortThreshold = 3;
                const visible = (a || '').trim();
                const visibleLen = visible.replace(/[\s\W_]+/g, '').length;
                if (visibleLen > 0 && visibleLen <= shortThreshold) {
                    chip.classList.add('lob-chip-short');
                    chip.style.textAlign = 'center';
                }

                mar.appendChild(chip);
            });
            arrWrap.appendChild(mar);
            main.appendChild(arrWrap);
            setTimeout(() => startMarquee(mar, MARQUEE_DURATION), 500);
        }

        el.appendChild(row);
        el.appendChild(main);

        const result = document.createElement('div');
        result.className = 'lob-result';
        result.textContent = 'ЗАБЛОКИРОВАНО';
        el.appendChild(result);

        setTimeout(() => el.classList.add('engage'), 40);
        setTimeout(() => el.classList.remove('engage'), 900);

        el.corpLobotomy = {
            release: function () {
                el.classList.remove('locked');
                el.classList.add('released');
                const res = el.querySelector('.lob-result');
                if (res) res.textContent = 'РАЗБЛОКИРОВАНО';
            },
            lock: function () {
                el.classList.remove('released');
                el.classList.add('locked');
                const res = el.querySelector('.lob-result');
                if (res) res.textContent = 'ЗАБЛОКИРОВАНО';
            }
        };
    }

    document.addEventListener('DOMContentLoaded', function () {
        const nodes = document.querySelectorAll('.corp-lobotomy');
        nodes.forEach(initElement);
    });

    window.corpLobotomy = {
        initElement,
        initAll: function (root) {
            const container = root || document;
            const nodes = container.querySelectorAll('.corp-lobotomy');
            nodes.forEach(initElement);
        }
    };
})();
