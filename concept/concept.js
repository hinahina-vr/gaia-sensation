(() => {
  "use strict";

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const reveals = [...document.querySelectorAll(".reveal")];
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px 30px 0px", threshold: .06 });
    for (const element of reveals) observer.observe(element);
  } else {
    for (const element of reveals) element.classList.add("is-visible");
  }


  const viewer = document.querySelector(".diagram-viewer");
  const openButton = document.querySelector("[data-open-diagram]");
  const zoomButton = document.querySelector("[data-zoom-diagram]");
  const closeButton = document.querySelector("[data-close-diagram]");
  const stage = document.querySelector(".viewer-stage");
  const diagram = document.querySelector("#machine-diagram").cloneNode(true);
  diagram.removeAttribute("id");
  stage.append(diagram);
  const setZoom = zoom => {
    viewer.classList.toggle("is-zoomed", zoom);
    zoomButton.setAttribute("aria-pressed", String(zoom));
    zoomButton.textContent = zoom ? "通常表示に戻す" : "拡大して読む";
    stage.scrollTo({ left: 0, top: 0, behavior: "instant" });
  };
  if (typeof viewer.showModal === "function") {
    openButton.hidden = false;
    openButton.addEventListener("click", () => {
      setZoom(false);
      viewer.showModal();
      closeButton.focus({ preventScroll: true });
    });
    zoomButton.addEventListener("click", () => setZoom(!viewer.classList.contains("is-zoomed")));
    closeButton.addEventListener("click", () => viewer.close());
    viewer.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const first = zoomButton;
      const last = stage;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    viewer.addEventListener("close", () => {
      setZoom(false);
      openButton.focus({ preventScroll: true });
    });
    viewer.addEventListener("click", event => {
      if (event.target !== viewer) return;
      const bounds = viewer.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
    });
  }

  const header = document.querySelector(".site-header");
  const boundary = document.querySelector("#depth-boundary");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  let frame = 0;
  const updateProgress = () => {
    frame = 0;
    const range = document.documentElement.scrollHeight - innerHeight;
    const progress = range > 0 ? Math.min(1, Math.max(0, scrollY / range)) : 0;
    document.documentElement.style.setProperty("--reading-progress", String(progress));
    const bounds = boundary.getBoundingClientRect();
    const theme = bounds.top + bounds.height * .55 <= header.offsetHeight ? "deep" : "light";
    if (header.dataset.theme !== theme) {
      header.dataset.theme = theme;
      themeColor.content = theme === "light" ? "#f5fbf9" : "#07111d";
    }
  };
  const scheduleProgress = () => {
    if (!frame) frame = requestAnimationFrame(updateProgress);
  };
  addEventListener("scroll", scheduleProgress, { passive: true });
  addEventListener("resize", scheduleProgress, { passive: true });
  addEventListener("load", scheduleProgress, { once: true });
  addEventListener("pageshow", scheduleProgress);
  addEventListener("gaia:language-change", scheduleProgress);
  motion.addEventListener("change", () => {
    if (motion.matches) for (const element of reveals) element.classList.add("is-visible");
  });
  document.body.dataset.enhanced = "true";
  updateProgress();
})();
