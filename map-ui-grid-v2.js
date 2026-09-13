(() => {
  const BODY_CLASS = "map-grid-desktop";
  const MARKER = "map-grid-v2";
  const specs = [
    { key: "intro", rx: /PLANETARY\s+LENS\s*\/\s*OPEN\s+MAP|世界のデータを見る/i },
    { key: "bank", rx: /INSTALLATION\s+BANK\s*\/\s*01\s*[–—-]\s*10/i },
    { key: "data", rx: /ACT\s*\d+\s*\/|ppm\s*\/\s*(?:実測|予想|予測)/i },
    { key: "scale", rx: /MAP\s*SCALE/i }
  ];

  let scheduled = false;
  let observer;

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 24 && r.height > 12 && s.display !== "none" && s.visibility !== "hidden";
  };

  const panelFrom = (node) => {
    let el = node;
    let fallback = null;
    for (let i = 0; el && el !== document.body && i < 9; i += 1, el = el.parentElement) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width >= 170 && r.width <= 760 && r.height >= 34 && r.height <= 560) {
        fallback = el;
        const positioned = s.position === "fixed" || s.position === "absolute";
        const painted = s.backgroundColor !== "rgba(0, 0, 0, 0)" || s.borderTopWidth !== "0px";
        if (positioned && painted) return el;
      }
    }
    return fallback;
  };

  const findPanel = (rx) => {
    const nodes = [...document.querySelectorAll("div, section, aside, header, nav")]
      .filter((el) => visible(el) && rx.test((el.textContent || "").replace(/\s+/g, " ")))
      .sort((a, b) => {
        const ar = a.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        return ar.width * ar.height - br.width * br.height;
      });
    for (const node of nodes) {
      const panel = panelFrom(node);
      if (panel) return panel;
    }
    return null;
  };

  const clear = () => {
    document.body.classList.remove(BODY_CLASS);
    document.querySelectorAll(`.${MARKER}`).forEach((el) => {
      el.classList.remove(MARKER, "map-grid-intro-v2", "map-grid-bank-v2", "map-grid-data-v2", "map-grid-scale-v2");
      el.style.removeProperty("top");
    });
  };

  const layout = () => {
    scheduled = false;
    if (innerWidth <= 900) {
      clear();
      return;
    }

    const panels = Object.fromEntries(specs.map(({ key, rx }) => [key, findPanel(rx)]));
    if (!panels.intro || !panels.bank || !panels.data || !panels.scale) return;

    document.body.classList.add(BODY_CLASS);
    Object.entries(panels).forEach(([key, panel]) => {
      panel.classList.add(MARKER, `map-grid-${key}-v2`);
    });

    const css = getComputedStyle(document.documentElement);
    const gutter = parseFloat(css.getPropertyValue("--map-ui-gutter")) || 28;
    const gap = parseFloat(css.getPropertyValue("--map-ui-gap")) || 16;

    panels.intro.style.setProperty("top", `${gutter}px`, "important");
    const bankTop = gutter + panels.intro.getBoundingClientRect().height + gap;
    panels.bank.style.setProperty("top", `${bankTop}px`, "important");
    const dataTop = bankTop + panels.bank.getBoundingClientRect().height + gap;
    panels.data.style.setProperty("top", `${dataTop}px`, "important");
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => setTimeout(layout, 40));
  };

  const start = () => {
    schedule();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    addEventListener("resize", schedule, { passive: true });
    addEventListener("hashchange", schedule);
    setTimeout(schedule, 500);
    setTimeout(schedule, 1400);
  };

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
