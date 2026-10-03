document.addEventListener("DOMContentLoaded", () => {
    const wrappers = document.querySelectorAll(".wiki-image-ai-wrapper");
    let active = null;

    function closeAll() {
        if (!active) {
            return;
        }

        active.classList.remove("is-open");
        active = null;
    }

    wrappers.forEach((wrapper) => {
        const badge = wrapper.querySelector(".wiki-image-ai-badge");

        if (!badge) {
            return;
        }

        badge.addEventListener("click", (event) => {
            event.stopPropagation();

            if (active === wrapper) {
                closeAll();
                return;
            }

            closeAll();

            wrapper.classList.add("is-open");
            active = wrapper;
        });

        wrapper.addEventListener("click", (event) => {
            event.stopPropagation();
        });
    });

    document.addEventListener("click", closeAll);
    window.addEventListener("scroll", closeAll, { passive: true });
    window.addEventListener("resize", closeAll);

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAll();
        }
    });
});
