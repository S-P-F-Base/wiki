document.addEventListener('DOMContentLoaded', function() {
    const wrappers = document.querySelectorAll('.aiuse-wrapper');
    let activeWrapper = null;

    function closeAll() {
        if (activeWrapper) {
            activeWrapper.classList.remove('is-open');
            activeWrapper = null;
        }
    }

    wrappers.forEach(wrapper => {
        wrapper.addEventListener('click', function(e) {
            e.stopPropagation();
            if (this.classList.contains('is-open')) {
                this.classList.remove('is-open');
                activeWrapper = null;
                return;
            }
            closeAll();
            this.classList.add('is-open');
            activeWrapper = this;
        });
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.aiuse-wrapper')) {
            closeAll();
        }
    });

    window.addEventListener('scroll', closeAll);
    window.addEventListener('resize', closeAll);
});
