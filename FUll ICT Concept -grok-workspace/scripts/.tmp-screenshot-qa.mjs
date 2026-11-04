import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge" }).catch(() => chromium.launch({ channel: "chrome" }));
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(msg.text());
});
page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));

await page.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle", timeout: 60000 });
await page.getByText("Skip sign-in · Explore demo").click();
await page.waitForTimeout(2000);
if (!page.url().includes("/journal")) {
  await page.goto("http://127.0.0.1:8080/journal", { waitUntil: "networkidle", timeout: 60000 });
}
await page.waitForTimeout(2000);
console.log("URL:", page.url());
console.log("Body head:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500));

await page.locator('button:has-text("Log trade")').first().click();
const form = page.getByRole("dialog");
await form.waitFor({ state: "visible" });
await form.getByRole("button", { name: /^Log trade$/ }).click();
await page.waitForTimeout(1500);
console.log("dialog still open:", await form.isVisible().catch(() => false));

const row = page.locator('[data-testid^="trade-row-"]').first();
console.log("row count:", await page.locator('[data-testid^="trade-row-"]').count());
console.log("row text:", (await row.innerText()).replace(/\s+/g, " ").slice(0, 200));
await row.click();
await page.waitForTimeout(1200);
console.log("panel count:", await page.locator("aside[aria-label='Trade details inspector']").count());
console.log("aside count:", await page.locator("aside").count());
console.log("selected class:", await row.getAttribute("class"));
console.log("body tail:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(-700));
console.log("CONSOLE ERRORS:", errors.length ? errors.join("\n---\n") : "none");
await browser.close();
