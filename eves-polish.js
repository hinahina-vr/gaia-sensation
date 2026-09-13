/* E.V.E.S. immersive choice layer */
(() => {
  if (window.__evesPolishLoaded) return;
  window.__evesPolishLoaded = true;

  const choices = [
    {
      match: /^感じる[。.]?$/,
      number: "01",
      title: "感じる",
      description: "まだ名前のない変化を受け取る",
      point: "ミズハの視点",
      icon: '<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="8"/><circle cx="36" cy="36" r="20"/><path d="M9 36c8-13 17-19 27-19s19 6 27 19c-8 13-17 19-27 19S17 49 9 36Z"/></svg>'
    },
    {
      match: /^測る[。.]?$/,
      number: "02",
      title: "測る",
      description: "揺らぎを記録し、確かめる",
      point: "アマネの視点",
      icon: '<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="18"/><path d="M36 6v18M36 48v18M6 36h18M48 36h18"/><circle cx="36" cy="36" r="3" class="fill"/></svg>'
    },
    {
      match: /^残す[。.]?$/,
      number: "03",
      title: "残す",
      description: "未来へ渡せる形に刻む",
      point: "サクヤの視点",
      icon: '<svg viewBox="0 0 72 72" aria-hidden="true"><path d="M13 20h46M13 36h38M13 52h29"/><path d="M54 42v18M45 51h18"/><circle cx="13" cy="20" r="2" class="fill"/><circle cx="13" cy="36" r="2" class="fill"/><circle cx="13" cy="52" r="2" class="fill"/></svg>'
    },
    {
      match: /^ともに選ぶ[。.]?$/,
      number: "04",
      title: "ともに選ぶ",
      description: "観測の先にある関係を選ぶ",
      point: "あなたの視点",
      icon: '<svg viewBox="0 0 72 72" aria-hidden="true"><circle cx="24" cy="28" r="7"/><circle cx="50" cy="43" r="7"/><path d="M29 32l15 8M16 45c5-8 12-12 20-12M38 53c5-7 11-10 18-10"/></svg>'
    }
  ];

  const style = document.createElement("style");
  style.textContent = `
    .eves-source-choice {
      display: none !important;
    }

    .eves-choice-screen {
      --eves-line: rgba(151, 226, 226, .28);
      --eves-light: #dffcf8;
      --eves-accent: #91e9df;
      position: relative;
      width: min(1040px, calc(100vw - 40px));
      margin: clamp(12px, 2.5vh, 28px) auto;
      padding: clamp(26px, 4vw, 52px);
      overflow: hidden;
      color: rgba(239, 252, 250, .96);
      border: 1px solid rgba(157, 226, 223, .32);
      background:
        radial-gradient(circle at 84% 15%, rgba(119, 216, 207, .12), transparent 28%),
        linear-gradient(135deg, rgba(5, 24, 35, .9), rgba(8, 24, 39, .76));
      box-shadow: 0 30px 90px rgba(0, 10, 20, .38), inset 0 1px rgba(255, 255, 255, .06);
      backdrop-filter: blur(18px) saturate(118%);
      -webkit-backdrop-filter: blur(18px) saturate(118%);
      isolation: isolate;
    }

    .eves-choice-screen::before,
    .eves-choice-screen::after {
      content: "";
      position: absolute;
      pointer-events: none;
      z-index: -1;
    }

    .eves-choice-screen::before {
      width: 380px;
      height: 380px;
      right: -115px;
      top: -160px;
      border: 1px solid rgba(147, 231, 222, .16);
      border-radius: 50%;
      box-shadow: 0 0 0 38px rgba(147, 231, 222, .035), 0 0 0 84px rgba(147, 231, 222, .022);
    }

    .eves-choice-screen::after {
      inset: 0;
      opacity: .22;
      background-image: radial-gradient(circle, rgba(179, 244, 237, .55) 0 1px, transparent 1.5px);
      background-size: 62px 62px;
      mask-image: linear-gradient(110deg, transparent 5%, #000 46%, transparent 96%);
    }

    .eves-choice-head {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: end;
      gap: 18px 26px;
      margin-bottom: clamp(24px, 3.5vw, 40px);
    }

    .eves-choice-kicker {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      gap: 12px;
      margin: 0;
      color: rgba(155, 231, 222, .78);
      font: 600 11px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace;
      letter-spacing: .22em;
    }

    .eves-choice-kicker::before {
      content: "";
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--eves-accent);
      box-shadow: 0 0 16px var(--eves-accent);
    }

    .eves-choice-question {
      margin: 0;
      font-family: inherit;
      font-size: clamp(27px, 4vw, 48px);
      font-weight: 500;
      line-height: 1.35;
      letter-spacing: .035em;
      text-wrap: balance;
    }

    .eves-choice-note {
      justify-self: end;
      margin: 0 0 .45em;
      color: rgba(210, 233, 232, .56);
      font-size: 12px;
      letter-spacing: .12em;
      white-space: nowrap;
    }

    .eves-choice-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .eves-choice-card {
      --choice-accent: #91e9df;
      position: relative;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas:
        "number title icon"
        "number description icon"
        "number point icon";
      column-gap: 18px;
      align-items: center;
      min-height: 154px;
      padding: 23px 24px;
      overflow: hidden;
      border: 1px solid rgba(163, 218, 219, .19);
      border-radius: 2px;
      color: inherit;
      text-align: left;
      font: inherit;
      cursor: pointer;
      background:
        linear-gradient(100deg, color-mix(in srgb, var(--choice-accent) 8%, transparent), transparent 48%),
        rgba(2, 13, 24, .44);
      box-shadow: inset 3px 0 0 color-mix(in srgb, var(--choice-accent) 75%, transparent);
      transition: transform .28s ease, border-color .28s ease, background-color .28s ease, box-shadow .28s ease;
    }

    .eves-choice-card::before {
      content: "";
      position: absolute;
      inset: -55% -30%;
      pointer-events: none;
      opacity: 0;
      transform: translateX(-58%) rotate(18deg);
      background: linear-gradient(90deg, transparent 42%, rgba(226, 255, 252, .24) 49%, rgba(255, 255, 255, .72) 50%, rgba(226, 255, 252, .18) 52%, transparent 58%);
      transition: opacity .2s ease, transform .72s cubic-bezier(.2,.7,.2,1);
    }

    .eves-choice-card:hover,
    .eves-choice-card:focus-visible {
      z-index: 2;
      outline: none;
      transform: translateY(-3px);
      border-color: color-mix(in srgb, var(--choice-accent) 72%, white 8%);
      background-color: color-mix(in srgb, var(--choice-accent) 10%, rgba(2, 13, 24, .55));
      box-shadow:
        inset 3px 0 0 var(--choice-accent),
        0 0 0 1px color-mix(in srgb, var(--choice-accent) 25%, transparent),
        0 18px 42px rgba(0, 8, 18, .28),
        0 0 28px color-mix(in srgb, var(--choice-accent) 13%, transparent);
    }

    .eves-choice-card:hover::before,
    .eves-choice-card:focus-visible::before {
      opacity: 1;
      transform: translateX(58%) rotate(18deg);
    }

    .eves-choice-number {
      grid-area: number;
      align-self: stretch;
      display: flex;
      align-items: flex-start;
      padding-top: 3px;
      color: var(--choice-accent);
      font: 600 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
      letter-spacing: .16em;
    }

    .eves-choice-title {
      grid-area: title;
      margin: 0;
      color: rgba(244, 255, 253, .98);
      font-size: clamp(22px, 2.4vw, 31px);
      font-weight: 500;
      line-height: 1.22;
      letter-spacing: .07em;
    }

    .eves-choice-description {
      grid-area: description;
      margin: 8px 0 0;
      color: rgba(214, 235, 234, .68);
      font-size: 13px;
      line-height: 1.55;
      letter-spacing: .04em;
    }

    .eves-choice-point {
      grid-area: point;
      margin: 11px 0 0;
      color: color-mix(in srgb, var(--choice-accent) 72%, white 12%);
      font: 600 10px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
      letter-spacing: .18em;
    }

    .eves-choice-icon {
      grid-area: icon;
      width: 58px;
      height: 58px;
      display: grid;
      place-items: center;
      border: 1px solid color-mix(in srgb, var(--choice-accent) 34%, transparent);
      border-radius: 50%;
      color: var(--choice-accent);
      background: color-mix(in srgb, var(--choice-accent) 5%, transparent);
      transition: transform .35s ease, box-shadow .35s ease;
    }

    .eves-choice-icon svg {
      width: 34px;
      height: 34px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.4;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .eves-choice-icon svg .fill {
      fill: currentColor;
      stroke: none;
    }

    .eves-choice-card:hover .eves-choice-icon,
    .eves-choice-card:focus-visible .eves-choice-icon {
      transform: scale(1.08) rotate(3deg);
      box-shadow: 0 0 24px color-mix(in srgb, var(--choice-accent) 25%, transparent), inset 0 0 16px color-mix(in srgb, var(--choice-accent) 8%, transparent);
    }

    @media (max-width: 720px) {
      .eves-choice-screen {
        width: calc(100vw - 24px);
        padding: 24px 16px 18px;
      }

      .eves-choice-head {
        display: block;
        margin-bottom: 22px;
      }

      .eves-choice-kicker {
        margin-bottom: 14px;
      }

      .eves-choice-note {
        margin-top: 10px;
        white-space: normal;
      }

      .eves-choice-grid {
        grid-template-columns: 1fr;
        gap: 9px;
      }

      .eves-choice-card {
        min-height: 118px;
        padding: 18px 17px;
        column-gap: 13px;
      }

      .eves-choice-icon {
        width: 48px;
        height: 48px;
      }

      .eves-choice-icon svg {
        width: 28px;
        height: 28px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .eves-choice-card,
      .eves-choice-card::before,
      .eves-choice-icon {
        transition: none !important;
      }
    }
  `;
  document.head.appendChild(style);

  const normalize = (value) => String(value || "").replace(/[\s\u3000]+/g, "").trim();

  const getTextNode = (matcher) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (matcher.test(normalize(node.nodeValue))) return node;
    }
    return null;
  };

  const matchedChoiceCount = (element) => {
    const text = normalize(element?.textContent);
    return choices.filter((choice) => choice.match.test(text) || text.includes(normalize(choice.title))).length;
  };

  const findChoiceRoot = (textNode) => {
    let current = textNode.parentElement;
    let root = current;
    while (current?.parentElement && current.parentElement !== document.body) {
      const parent = current.parentElement;
      if (matchedChoiceCount(parent) !== 1) break;
      root = parent;
      current = parent;
    }
    return root;
  };

  const commonAncestor = (elements) => {
    let ancestor = elements[0]?.parentElement;
    while (ancestor && !elements.every((element) => ancestor.contains(element))) {
      ancestor = ancestor.parentElement;
    }
    return ancestor;
  };

  const directChildOf = (host, element) => {
    let child = element;
    while (child?.parentElement && child.parentElement !== host) child = child.parentElement;
    return child;
  };

  const resolveClickTarget = (source) => {
    if (source.matches("button, a, [role='button'], [tabindex]")) return source;
    return source.querySelector("button, a, [role='button'], [tabindex]") || source;
  };

  const createCard = (choice, source, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eves-choice-card";
    button.style.setProperty("--choice-accent", ["#8deadd", "#82caff", "#d8b3ff", "#ffe2a0"][index]);
    button.setAttribute("aria-label", `${choice.title}。${choice.description}`);
    button.innerHTML = `
      <span class="eves-choice-number">${choice.number}</span>
      <strong class="eves-choice-title">${choice.title}</strong>
      <span class="eves-choice-description">${choice.description}</span>
      <span class="eves-choice-point">${choice.point}</span>
      <span class="eves-choice-icon">${choice.icon}</span>
    `;
    button.addEventListener("click", () => resolveClickTarget(source).click());
    return button;
  };

  const build = () => {
    if (document.querySelector(".eves-choice-screen")) return true;

    const textNodes = choices.map((choice) => getTextNode(choice.match));
    if (textNodes.some((node) => !node)) return false;

    const sourceRoots = textNodes.map(findChoiceRoot);
    if (sourceRoots.some((root) => !root)) return false;

    const host = commonAncestor(sourceRoots);
    if (!host || host === document.body || host === document.documentElement) return false;

    const anchor = directChildOf(host, sourceRoots[0]);
    const screen = document.createElement("section");
    screen.className = "eves-choice-screen";
    screen.setAttribute("aria-labelledby", "eves-choice-question");
    screen.innerHTML = `
      <header class="eves-choice-head">
        <p class="eves-choice-kicker">E.V.E.S. / CHOICE</p>
        <h2 class="eves-choice-question" id="eves-choice-question">地球の声に、どう応えますか。</h2>
        <p class="eves-choice-note">選択は、物語の見え方を変える。</p>
      </header>
      <div class="eves-choice-grid"></div>
    `;

    const grid = screen.querySelector(".eves-choice-grid");
    choices.forEach((choice, index) => grid.appendChild(createCard(choice, sourceRoots[index], index)));
    sourceRoots.forEach((source) => source.classList.add("eves-source-choice"));
    host.insertBefore(screen, anchor || host.firstChild);
    return true;
  };

  const start = () => {
    if (build()) return;
    const observer = new MutationObserver(() => {
      if (build()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 30000);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
