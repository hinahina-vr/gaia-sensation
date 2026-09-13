import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [moduleRoot, executablePath, outputArgument, baseUrl = "http://127.0.0.1:4184"] = process.argv.slice(2);
if (!moduleRoot || !executablePath) throw new Error("Playwright module and browser executable are required");
const playwrightEntry = fs.existsSync(path.join(moduleRoot, "index.mjs"))
  ? path.join(moduleRoot, "index.mjs")
  : path.join(moduleRoot, "playwright", "index.mjs");
const { chromium } = await import(pathToFileURL(playwrightEntry).href);
const outputDir = path.resolve(outputArgument || "artifacts/campus-chat-channels-browser");
fs.mkdirSync(outputDir, { recursive: true });

const stepId = "welcome_chat_023";
const expectedChannels = [
  "大学からのお知らせ_公式",
  "class_ネットワーク産業論",
  "class_数理構造の発見と活用",
  "26_2年春21クラス",
];
const viewports = [
  { name: "pc-1440", width: 1440, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
];
const report = { status: "running", baseUrl, scans: [], consoleErrors: [], pageErrors: [], responses404: [] };

const stateFor = (storyVersion, viewport) => ({
  storyVersion,
  stepId,
  reachedSceneIds: ["welcome_chat"],
  viewed: {},
  metCharacters: { mizuha: true, amane: true, sakuya: true },
  evesRoute: [],
  observationOrder: "LOCAL_FIRST",
  editorialChoice: null,
  reflectionIds: [],
  resultTone: null,
  demoInterest: "",
  audio: { muted: true, volume: 0 },
  readStepIds: [],
  clear: false,
  archivesUnlocked: false,
  sessionId: `campus-chat-channels-${viewport}`,
});

const browser = await chromium.launch({ headless: true, executablePath });
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(`${viewport.name}: ${message.text()}`); });
    page.on("pageerror", (error) => report.pageErrors.push(`${viewport.name}: ${error.message}`));
    page.on("response", (response) => { if (response.status() === 404) report.responses404.push(`${viewport.name}: ${response.url()}`); });

    await page.goto(new URL("/story", baseUrl).href, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel && globalThis.GAIA_NOVEL_STORY));
    const storyVersion = 13;
    const progress = stateFor(storyVersion, viewport.name);
    await page.addInitScript((candidate) => {
      localStorage.setItem("gaiaSensewareNovel:progress", JSON.stringify(candidate));
      localStorage.setItem("gaiaSensewareNovel:manual-saves", JSON.stringify([{
        progress: candidate,
        savedAt: Date.now(),
        meta: { title: "Campus channels QA", excerpt: candidate.stepId },
      }]));
      localStorage.setItem("gaiaSensewareNovel:config:v4", JSON.stringify({ messageSpeedPercent: 400, reducedMotion: true }));
      localStorage.setItem("gaia-senseware-bgm-volume", "0");
    }, progress);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(globalThis.GaiaNovel));
    const resumed = await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId, { timeout: 8000 }).then(() => true, () => false);
    if (!resumed) {
      await page.locator("#novel-resume-button").click();
      await page.locator("#novel-save-panel").waitFor({ state: "visible" });
      await page.locator('.novel-save-slot[data-slot-index="0"]').click();
    }
    await page.waitForFunction((id) => document.querySelector("#novel-layer")?.dataset.stepId === id, stepId);
    await page.locator(".novel-slack-workspace").waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const images = [...document.querySelectorAll(".novel-slack-avatar img")];
      return images.length >= 1 && images.every((image) => image.complete && image.naturalWidth > 0);
    });
    await page.locator(".novel-slack-avatar img").evaluateAll((images) => Promise.all(images.map((image) => image.decode().catch(() => {}))));

    await page.locator("#gaia-boot").waitFor({ state: "hidden" });
    const scan = await page.evaluate(() => {
      const aside = document.querySelector(".novel-slack-workspace > aside");
      const asideRect = aside?.getBoundingClientRect();
      const channels = [...document.querySelectorAll(".novel-slack-school-channel")].map((channel) => {
        const rect = channel.getBoundingClientRect();
        return {
          text: channel.textContent?.trim() || "",
          channel: channel.dataset.channel || "",
          title: channel.getAttribute("title") || "",
          visible: rect.width > 0 && rect.height > 0,
          fullyInsideSidebar: Boolean(asideRect && rect.top >= asideRect.top && rect.bottom <= asideRect.bottom && rect.left >= asideRect.left && rect.right <= asideRect.right),
          clippedInline: channel.scrollWidth > channel.clientWidth + 1,
          lineHeight: Number.parseFloat(getComputedStyle(channel).lineHeight) || 0,
          height: rect.height,
        };
      });
      const current = aside?.querySelector(".is-current");
      const currentRect = current?.getBoundingClientRect();
      const sensorChannel = aside?.querySelector(".novel-slack-circle-channel");
      const sensorChannelRect = sensorChannel?.getBoundingClientRect();
      const directMessages = [...aside.querySelectorAll(".novel-slack-dm")].map((entry) => ({
        id: entry.dataset.directMessage || "",
        text: entry.textContent?.trim() || "",
        presence: entry.querySelector(".novel-slack-dm-presence")?.dataset.presence || "",
      }));
      const privateChannel = aside?.querySelector('.novel-slack-school-channel[data-channel="26_2年春21クラス"]');
      return {
        stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
        generalPresent: [...aside.children].some((el) => /^#\\s*general$/.test(el.textContent.trim())),
        fonts: [...document.querySelectorAll(".novel-slack-channel-title, .novel-slack-message")].map((el) => getComputedStyle(el).fontFamily),
        sidebarVisible: Boolean(asideRect && asideRect.width > 0 && asideRect.height > 0),
        headerTitle: document.querySelector(".novel-slack-channel-title")?.textContent?.trim() || "",
        channels,
        currentText: current?.textContent?.trim() || "",
        currentAria: current?.getAttribute("aria-current") || "",
        currentVisible: Boolean(currentRect && currentRect.width > 0 && currentRect.height > 0),
        sensorChannel: {
          text: sensorChannel?.textContent?.trim() || "",
          channel: sensorChannel?.dataset.channel || "",
          title: sensorChannel?.getAttribute("title") || "",
          visible: Boolean(sensorChannelRect && sensorChannelRect.width > 0 && sensorChannelRect.height > 0),
          fullyInsideSidebar: Boolean(asideRect && sensorChannelRect && sensorChannelRect.width > 0 && sensorChannelRect.height > 0 && sensorChannelRect.top >= asideRect.top && sensorChannelRect.bottom <= asideRect.bottom && sensorChannelRect.left >= asideRect.left && sensorChannelRect.right <= asideRect.right),
        },
        directMessages,
        privateChannel: {
          tagName: privateChannel?.tagName || "",
          locked: privateChannel?.classList.contains("is-private") || false,
          lockIcon: privateChannel?.querySelector(".novel-slack-channel-icon")?.textContent?.trim() || "",
          ariaLabel: privateChannel?.getAttribute("aria-label") || "",
        },
        sidebarOverflowX: aside ? Math.max(0, aside.scrollWidth - aside.clientWidth) : -1,
        overflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
        currentMessage: document.querySelector(".novel-slack-post.is-new .novel-slack-message")?.textContent || "",
        avatarImagesLoaded: [...document.querySelectorAll(".novel-slack-avatar img")].filter((image) => image.complete && image.naturalWidth > 0).length,
      };
    });
    assert.equal(scan.generalPresent, false);
    assert(scan.fonts.length > 0 && scan.fonts.every((font) => font.includes("Noto Sans JP") && !font.includes("Mincho")), "Chat must use Gothic fonts");
    assert.equal(scan.stepId, stepId, `${viewport.name}: target step did not render`);
    assert.deepEqual(scan.channels.map((channel) => channel.channel), expectedChannels, `${viewport.name}: school channel IDs differ`);
    assert.deepEqual(scan.channels.slice(0, 3).map((channel) => channel.title), expectedChannels.slice(0, 3), `${viewport.name}: full public channel labels are unavailable`);
    assert.match(scan.channels[3].title, /26_2年春21クラス.*プライベート/u, `${viewport.name}: private channel title does not announce its state`);
    assert.deepEqual(scan.channels.slice(0, 3).map((channel) => channel.text), expectedChannels.slice(0, 3).map((channel) => `# ${channel}`), `${viewport.name}: displayed public channel labels differ`);
    assert.match(scan.channels[3].text, /🔒\s*26_2年春21クラス/u, `${viewport.name}: private channel lacks a visible lock`);
    if (viewport.name === "pc-1440") {
      assert(scan.sidebarVisible && scan.channels.every((channel) => channel.visible && channel.fullyInsideSidebar), `${viewport.name}: a school channel is outside the sidebar`);
      assert(scan.channels.every((channel) => !channel.clippedInline), "pc-1440: a school channel label is truncated");
    } else {
      assert.equal(scan.sidebarVisible, false, `${viewport.name}: smartphone chat unexpectedly exposes the sidebar`);
      assert.equal(scan.headerTitle, "# 惑星の放課後_センサー", `${viewport.name}: smartphone header does not show the sensor channel name`);
    }
    assert.equal(scan.currentText, "# 惑星の放課後_センサー", `${viewport.name}: sensor channel lost selection`);
    assert.equal(scan.currentAria, "page", `${viewport.name}: selected channel semantics are missing`);
    assert.equal(scan.currentVisible, viewport.name === "pc-1440", `${viewport.name}: selected story channel visibility is incorrect`);
    assert.deepEqual(scan.directMessages, [{ id: "cc_hinahina", text: "cc_hinahina", presence: "online" }], `${viewport.name}: direct-message list is not limited to cc_hinahina`);
    assert.deepEqual(scan.privateChannel, {
      tagName: "BUTTON",
      locked: true,
      lockIcon: "🔒",
      ariaLabel: "26_2年春21クラス、鍵付きプライベートチャネル",
    }, `${viewport.name}: locked class channel is not an accessible selectable control`);
    assert.deepEqual(scan.sensorChannel, {
      text: "# 惑星の放課後_センサー",
      channel: "惑星の放課後_センサー",
      title: "惑星の放課後_センサー",
      visible: viewport.name === "pc-1440",
      fullyInsideSidebar: viewport.name === "pc-1440",
    }, `${viewport.name}: 惑星の放課後 channel label is missing from the sidebar`);
    assert.equal(scan.sidebarOverflowX, 0, `${viewport.name}: sidebar has horizontal overflow`);
    assert.equal(scan.overflowX, 0, `${viewport.name}: page has horizontal overflow`);
    assert.match(scan.currentMessage, /ESP32からGAIA SENSEWAREへのインジェスト構成案/u, `${viewport.name}: current sensor-channel message changed`);
    assert(scan.avatarImagesLoaded >= 1, `${viewport.name}: symbolic chat avatars did not load`);
    const memo = page.locator('.novel-slack-post.is-new .novel-slack-attachment img');
    assert.match(await memo.getAttribute('src'), /gaia-field-sensor-whiteboard-20260912\.png$/);
    await memo.evaluate(async image => { await image.decode(); if (!image.naturalWidth) throw new Error('Memo failed to decode'); });
    await page.screenshot({ path: path.join(outputDir, `${viewport.name}.png`), animations: "disabled" });

    let privateSelection = null;
    let restoredStory = null;
    if (viewport.name === "pc-1440") {
      await page.locator('.novel-slack-school-channel[data-channel="26_2年春21クラス"]').click();
      privateSelection = await page.evaluate(() => ({
      activeChannel: document.querySelector(".novel-slack-workspace")?.dataset.activeChannel || "",
      currentChannel: document.querySelector(".novel-slack-workspace > aside .is-current")?.dataset.channel || "",
      currentAria: document.querySelector(".novel-slack-workspace > aside .is-current")?.getAttribute("aria-current") || "",
      title: document.querySelector(".novel-slack-channel-title")?.textContent?.trim() || "",
      description: document.querySelector(".novel-slack-channel-description")?.textContent?.trim() || "",
      notice: document.querySelector(".novel-slack-private-notice p")?.textContent?.trim() || "",
      currentPostCount: document.querySelectorAll(".novel-slack-post.is-new").length,
      stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
    }));
      assert.equal(privateSelection.activeChannel, "26_2年春21クラス");
      assert.equal(privateSelection.currentChannel, "26_2年春21クラス");
      assert.equal(privateSelection.currentAria, "page");
      assert.equal(privateSelection.title, "🔒 26_2年春21クラス");
      assert.match(privateSelection.description, /プライベートチャネル/u);
      assert.match(privateSelection.notice, /メンバーだけが閲覧/u);
      assert.equal(privateSelection.currentPostCount, 0, `${viewport.name}: story posts leaked into the private channel`);
      assert.equal(privateSelection.stepId, stepId, `${viewport.name}: channel selection advanced the story`);
      await page.screenshot({ path: path.join(outputDir, `${viewport.name}-private.png`), animations: "disabled" });

      await page.locator('.novel-slack-circle-channel[data-channel="惑星の放課後_センサー"]').click();
      restoredStory = await page.evaluate(() => ({
      activeChannel: document.querySelector(".novel-slack-workspace")?.dataset.activeChannel || "",
      currentChannel: document.querySelector(".novel-slack-workspace > aside .is-current")?.dataset.channel || "",
      currentMessage: document.querySelector(".novel-slack-post.is-new .novel-slack-message")?.textContent || "",
      stepId: document.querySelector("#novel-layer")?.dataset.stepId || "",
    }));
      assert.equal(restoredStory.activeChannel, "惑星の放課後_センサー");
      assert.equal(restoredStory.currentChannel, "惑星の放課後_センサー");
      assert.equal(restoredStory.currentMessage, scan.currentMessage, `${viewport.name}: current/read position was not restored`);
      assert.equal(restoredStory.stepId, stepId, `${viewport.name}: returning to the story channel advanced the story`);
    }
    report.scans.push({ viewport: viewport.name, ...scan, privateSelection, restoredStory, passed: true });
    await context.close();
  }
  assert.equal(report.consoleErrors.length, 0, `console errors: ${report.consoleErrors.join("\n")}`);
  assert.equal(report.pageErrors.length, 0, `page errors: ${report.pageErrors.join("\n")}`);
  assert.equal(report.responses404.length, 0, `404 responses: ${report.responses404.join("\n")}`);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack || String(error);
  throw error;
} finally {
  fs.writeFileSync(path.join(outputDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}

console.log(`Campus chat channels browser check passed: ${report.scans.length} viewports`);
