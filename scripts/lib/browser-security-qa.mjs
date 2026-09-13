import fs from "node:fs";
export const securityHeaders = JSON.parse(fs.readFileSync(new URL("../../sensor-platform/src/browser-security.ts", import.meta.url), "utf8").split(" = ")[1].trim().replace(/;$/, ""));
export async function enforceBrowserSecurity(context, base) {
  // Production smoke must inspect the server's actual headers, not replace them.
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname);
  if (local) await context.route(`${base}/**`, async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), ...securityHeaders } });
  });
  await context.addInitScript(() => {
    window.__securityViolations = [];
    document.addEventListener("securitypolicyviolation", event => window.__securityViolations.push({ directive: event.effectiveDirective, blocked: event.blockedURI, source: event.sourceFile, line: event.lineNumber, sample: event.sample }));
  });
}
