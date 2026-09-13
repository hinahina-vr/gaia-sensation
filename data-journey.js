(() => {
  "use strict";

  const journey = document.querySelector("[data-data-journey]");
  if (!journey) return;

  const chapters = [...journey.querySelectorAll("[data-data-chapter]")];
  const cards = [...journey.querySelectorAll(".data-source-card")];
  const navLinks = [...document.querySelectorAll(".data-journey-index a")];
  const progress = document.querySelector(".data-journey-progress i");
  const introLayer = journey.closest("#intro-layer");
  const dataSection = journey.closest(".data-glossary");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const records = [
    ["GOSAT", "XCO₂ → 地図の色"],
    ["NOAA マウナロア", "CO₂月平均 → 呼吸する時間軸"],
    ["NASA GISTEMP", "気温偏差 → 背景の温度"],
    ["CoastWatch / POWER", "海流・風 → 光の流線"],
    ["MODIS / VIIRS", "土地・夜間光 → 昼夜の二層"],
    ["SDG 12.5.1", "再資源化率 → 粒子の行き先"],
    ["GCP / World Bank", "排出・都市・電力 → 分離した三層"],
    ["気象庁 / USGS", "震度・規模 → 到達する二つの波"],
    ["UNESCO", "登録地 → 残したい場所"],
    ["NASA DONKI", "フレア・CME → 光と磁力線"],
    ["NASA/JPL CNEOS", "最接近距離 → 軌道の間隔"],
    ["Exoplanet Archive", "半径・温度 → 惑星の大きさと色"],
    ["JAXA DARTS", "LIDAR距離 → リュウグウの輪郭"],
  ];

  cards.forEach((card, index) => {
    const [source, encoding] = records[index] || [card.querySelector("h4")?.textContent?.trim() || "PUBLIC DATA", "観測値 → 光と動き"];
    card.dataset.journeySource = source;
    card.dataset.journeyEncoding = encoding;
  });

  const selectCard = (card) => {
    const chapter = card.closest("[data-data-chapter]");
    if (!chapter || card.classList.contains("is-active")) return;
    chapter.querySelectorAll(".data-source-card.is-active").forEach((item) => item.classList.remove("is-active"));
    card.classList.add("is-active");

    const readout = chapter.querySelector(".data-scene-readout");
    if (!readout) return;
    const source = readout.querySelector("strong");
    const encoding = readout.querySelector("small");
    if (source) source.textContent = card.dataset.journeySource;
    if (encoding) encoding.textContent = card.dataset.journeyEncoding;
    readout.classList.remove("is-changing");
    void readout.offsetWidth;
    readout.classList.add("is-changing");
  };

  const setCurrentChapter = (chapter) => {
    chapters.forEach((item) => item.classList.toggle("is-current", item === chapter));
    navLinks.forEach((link) => {
      const active = link.getAttribute("href") === `#${chapter.id}`;
      if (active) link.setAttribute("aria-current", "step");
      else link.removeAttribute("aria-current");
    });
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { rootMargin: "8% 0px -10%", threshold: 0.08 });

  const activeCardObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]) selectCard(visible[0].target);
  }, { rootMargin: "-30% 0px -42%", threshold: [0.05, 0.2, 0.45, 0.7] });

  const chapterObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
    if (visible[0]) setCurrentChapter(visible[0].target);
  }, { rootMargin: "-25% 0px -50%", threshold: [0.01, 0.2, 0.45] });

  cards.forEach((card) => {
    revealObserver.observe(card);
    activeCardObserver.observe(card);
  });
  chapters.forEach((chapter) => chapterObserver.observe(chapter));

  chapters.forEach((chapter) => {
    const first = chapter.querySelector(".data-source-card");
    if (first) selectCard(first);
  });

  let ticking = false;
  const updateScrollState = () => {
    ticking = false;
    const rect = journey.getBoundingClientRect();
    const dataRect = dataSection?.getBoundingClientRect();
    introLayer?.classList.toggle("is-reading-data", !introLayer.hidden && Boolean(dataRect && dataRect.top <= 72 && dataRect.bottom > 72));
    const total = Math.max(1, rect.height - window.innerHeight);
    const passed = Math.min(total, Math.max(0, window.innerHeight * 0.48 - rect.top));
    if (progress) progress.style.width = `${(passed / total) * 100}%`;

    if (reducedMotion) return;
    chapters.forEach((chapter) => {
      const chapterRect = chapter.getBoundingClientRect();
      if (chapterRect.bottom < -200 || chapterRect.top > window.innerHeight + 200) return;
      const centerDelta = (chapterRect.top + chapterRect.height / 2 - window.innerHeight / 2) / Math.max(window.innerHeight, chapterRect.height);
      chapter.style.setProperty("--scene-shift", `${Math.max(-26, Math.min(26, centerDelta * -34)).toFixed(1)}px`);
    });
  };

  const requestScrollUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateScrollState);
  };

  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  introLayer?.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });
  updateScrollState();

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
  });
})();
