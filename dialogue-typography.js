// Shared, source-preserving Japanese dialogue typography for both story runtimes.
(() => {
  "use strict";
  const DIALOGUE_PARTICLES = new Set(["は", "が", "を", "に", "へ", "と", "で", "の", "も", "や", "か", "ね", "よ"]);
  const DIALOGUE_INFLECTION_SUFFIXES = new Set([
    "た", "だ", "て", "で", "ば", "れ", "る", "く", "さ", "し", "たり", "したり", "え", "てい", "わ", "ない", "なく", "たい", "ます", "です", "ました", "ません", "れる", "られる", "たち",
  ]);
  const DIALOGUE_OPENING = /^[「『（【［〈《〔“‘]/u;
  const DIALOGUE_CLOSING = /^[、。，．？！…」』）】］〉》〕ぁぃぅぇぉゃゅょっァィゥェォャュョッー]/u;
  const DIALOGUE_KANJI_END = /[一-龠々〆ヵヶ]$/u;
  const DIALOGUE_PROTECTED = ["GAIA SENSEWARE", "GAIA Transformation", "リアルタイム", "ものづくり", "そのもの"];
  const DIALOGUE_NUMERAL = /^[0-9０-９一二三四五六七八九十百千万億兆数.．]+$/u;
  const DIALOGUE_UNITS = new Set(["年", "月", "日", "秒", "分", "時", "時間", "人", "台", "個", "回", "度", "%", "％", "℃", "km", "mm", "ppm"]);

  const fallbackDialogueSegments = (source) => {
    const protectedPattern = DIALOGUE_PROTECTED.map((value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")).join("|");
    const pattern = new RegExp(`(${protectedPattern}|\\r?\\n|[ \\t　]+|[A-Za-z0-9]+(?:[ .+/#_-][A-Za-z0-9]+)*|[ぁ-んァ-ヶー一-龠々〆ヵヶ]+|.)`, "gu");
    return source.match(pattern) || [];
  };

  const segmentDialoguePhrases = (source, { forceFallback = false } = {}) => {
    const text = String(source || "");
    const raw = [];
    if (!forceFallback && globalThis.Intl?.Segmenter) {
      const segmenter = new Intl.Segmenter(globalThis.GaiaI18n?.get() || "ja", { granularity: "word" });
      for (const part of segmenter.segment(text)) raw.push(part.segment);
    } else {
      raw.push(...fallbackDialogueSegments(text));
    }
    const protectedMerged = [];
    for (let index = 0; index < raw.length;) {
      const remainder = raw.slice(index).join("");
      const protectedWord = DIALOGUE_PROTECTED.find((word) => remainder.startsWith(word));
      if (protectedWord) {
        let consumed = "";
        while (index < raw.length && consumed.length < protectedWord.length) consumed += raw[index++];
        protectedMerged.push(consumed);
      } else {
        protectedMerged.push(raw[index++]);
      }
    }
    const tokens = [];
    let pendingOpening = "";
    protectedMerged.forEach((value) => {
      if (!value) return;
      if (/^\r?\n$/u.test(value) || /^[ \t　]+$/u.test(value)) {
        if (pendingOpening) tokens.push(pendingOpening);
        pendingOpening = "";
        tokens.push(value);
        return;
      }
      if (DIALOGUE_OPENING.test(value)) {
        pendingOpening += value;
        return;
      }
      const token = `${pendingOpening}${value}`;
      pendingOpening = "";
      const previous = tokens.at(-1);
      const inflectionCore = value.replace(/[、。，．？！…」』）】］〉》〕]+$/u, "");
      if (previous && !/^\s+$/u.test(previous) && (
        DIALOGUE_CLOSING.test(value)
        || DIALOGUE_PARTICLES.has(value)
        // ICU may separate compounds such as 氷/殻 and 千年/単位.
        || ((globalThis.GaiaI18n?.get() || "ja") === "ja" && DIALOGUE_KANJI_END.test(previous) && /^[一-龠々〆ヵヶ]/u.test(inflectionCore))
        || (DIALOGUE_KANJI_END.test(previous) && /^[ぁ-んァ-ヶー]/u.test(inflectionCore)
          && !["だけ", "ほど", "など"].includes(inflectionCore))
        || (/[ァ-ヶー]$/u.test(previous) && /^[ァ-ヶー]/u.test(inflectionCore))
        || (DIALOGUE_NUMERAL.test(previous) && (DIALOGUE_NUMERAL.test(inflectionCore) || DIALOGUE_UNITS.has(inflectionCore)))
        || (DIALOGUE_INFLECTION_SUFFIXES.has(inflectionCore) && /[ぁ-んァ-ヶー一-龠々〆ヵヶ]$/u.test(previous))
      )) {
        tokens[tokens.length - 1] += token;
      } else {
        tokens.push(token);
      }
    });
    if (pendingOpening) tokens.push(pendingOpening);
    if (tokens.join("") !== text) return fallbackDialogueSegments(text);
    return tokens;
  };

  const buildDialogueTokenLayout = (text, options) => {
    const root = document.createElement("span");
    root.className = "novel-token-layout";
    let offset = 0;
    segmentDialoguePhrases(text, options).forEach((token) => {
      if (/^\r?\n$/u.test(token)) {
        const lineBreak = document.createElement("br");
        lineBreak.dataset.sourceBreak = token;
        root.append(lineBreak);
      } else {
        const span = document.createElement("span");
        span.className = /^\s+$/u.test(token) ? "novel-space-token" : "novel-phrase-token";
        span.textContent = token;
        span.dataset.sourceStart = String(offset);
        span.dataset.sourceEnd = String(offset + token.length);
        root.append(span);
      }
      offset += token.length;
    });
    root.dataset.sourceLength = String(text.length);
    return root;
  };

  // Choose readable lines within the SAME minimum line count. Punctuation is
  // preferable to splitting a clause; an isolated ending such as 「いた。」 is
  // preferable on the preceding line. No source characters are added or lost.
  const chooseDialogueLineBreaks = (tokens, width) => {
    // Avoid breaking the short nested quotations used for named concepts.
    // This is a preference, not a no-wrap box: narrow screens still have
    // ordinary word boundaries available inside a long quotation.
    const insideQuote = [false];
    let quoteDepth = 0;
    tokens.forEach(({text}) => {
      for (const glyph of text) {
        if (glyph === "『") quoteDepth += 1;
        if (glyph === "』") quoteDepth = Math.max(0, quoteDepth - 1);
      }
      insideQuote.push(quoteDepth > 0);
    });
    const best = Array(tokens.length + 1).fill(null);
    best[tokens.length] = { lines: 0, cost: 0, next: tokens.length };
    for (let start = tokens.length - 1; start >= 0; start -= 1) {
      let occupied = 0;
      let characters = 0;
      for (let end = start + 1; end <= tokens.length; end += 1) {
        occupied += tokens[end - 1].width;
        characters += Array.from(tokens[end - 1].text).length;
        // A sum just over the column was previously accepted as a two-line
        // plan, then the browser wrapped its last token onto a third line.
        // Reserve a subpixel rounding margin instead of allowing overflow.
        if (occupied > width - 1) break;
        if (!best[end]) continue;
        const tail = tokens[end - 1].text.trimEnd();
        const next = tokens[end]?.text || "";
        let boundaryCost = 0;
        if (end < tokens.length) {
          boundaryCost = /[。！？!?][」』）】］〉》〕]*$/u.test(tail) ? 0
            : /[、，,：:；;][」』）】］〉》〕]*$/u.test(tail) ? 12 : 130;
          if (/[てで]$/u.test(tail) && /^(?:い[たる]|いる|おり|しま|ください)/u.test(next)) boundaryCost += 220;
          if (/^(?:なく|ない|ません)/u.test(next)) boundaryCost += 220;
          if (insideQuote[end]) boundaryCost += 240;
        }
        const slack = Math.max(0, 1 - occupied / width);
        const orphanCost = end === tokens.length && start > 0 && characters <= 3 ? 180 : 0;
        const candidate = { lines: best[end].lines + 1, cost: best[end].cost + boundaryCost + slack * slack * 60 + orphanCost, next: end };
        if (!best[start] || candidate.lines < best[start].lines
          || (candidate.lines === best[start].lines && candidate.cost < best[start].cost)) best[start] = candidate;
      }
    }
    const breaks = [];
    for (let index = 0; best[index] && best[index].next < tokens.length; index = best[index].next) breaks.push(best[index].next);
    return breaks;
  };


  const wrapLayout = (target, layout) => {
    layout.querySelectorAll("[data-dialogue-wrap]").forEach((node) => node.remove());
    target.replaceChildren(layout);
    // Keep ordinary Japanese phrase tokens intact. Only a token wider than
    // the entire column (including the no-Segmenter fallback) may wrap inside.
    const availableWidth = target.getBoundingClientRect().width;
    layout.querySelectorAll(".novel-phrase-token").forEach((token) => {
      token.classList.remove("is-breakable");
      if (token.getBoundingClientRect().width > availableWidth + 0.5) token.classList.add("is-breakable");
    });
    let paragraph = [];
    const wrapParagraph = () => {
      if (paragraph.length > 1 && paragraph.every((token) => !token.node.classList.contains("is-breakable"))) {
        for (const offset of chooseDialogueLineBreaks(paragraph, availableWidth)) {
          const lineBreak = document.createElement("br");
          lineBreak.dataset.dialogueWrap = "";
          paragraph[offset].node.before(lineBreak);
        }
      }
      paragraph = [];
    };
    for (const node of [...layout.childNodes]) {
      if (node instanceof HTMLBRElement) wrapParagraph();
      else if (node instanceof HTMLElement) paragraph.push({ node, text: node.textContent || "", width: node.getBoundingClientRect().width });
    }
    wrapParagraph();
    return layout;
  };

  globalThis.GaiaDialogueTypography = Object.freeze({
    segment: segmentDialoguePhrases,
    createLayout: buildDialogueTokenLayout,
    chooseLineBreaks: chooseDialogueLineBreaks,
    wrapLayout,
  });
})();
