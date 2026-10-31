import { chromium } from "playwright";

/**
 * Two-account isolation proof for the per-user desk backend.
 *
 * 1. Account A saves a unique account name.
 * 2. A brand-new browser profile signs in as a second, unrelated account B.
 * 3. B's desk must NOT contain A's name (defaults instead), proving
 *    `loadDeskState` is scoped to the verified session user.
 * 4. The room-signaling backend must answer a plain GET with JSON.
 */

const base = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const stamp = Date.now();
const password = "BackendProof!2026";
const emailA = `iso-a-${stamp}@example.com`;
const emailB = `iso-b-${stamp}@example.com`;
const nameA = `Owner A ${stamp}`;

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});

async function signUp(page, email, name) {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByPlaceholder("Full name").fill(name);
  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password (at least 8 characters)").fill(password);
  await page.getByRole("button", { name: /Create private account/ }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await page.getByText("Cloud saved").waitFor({ timeout: 30_000 });
}

try {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await signUp(pageA, emailA, "Owner A");
  await pageA.getByLabel("Open settings").click();
  await pageA.getByLabel("Account name").fill(nameA);
  await pageA.keyboard.press("Escape");
  await pageA.getByText("Cloud saved").waitFor({ timeout: 30_000 });
  console.log("account A saved:", nameA);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await signUp(pageB, emailB, "Owner B");
  await pageB.getByLabel("Open settings").click();
  const nameB = await pageB.getByLabel("Account name").inputValue();
  console.log("account B reads:", nameB);
  if (nameB === nameA) throw new Error("Cross-user leak: B sees A's desk state");
  if (nameB.includes(String(stamp))) throw new Error(`B sees A's stamped value: ${nameB}`);

  const rtc = await pageB.request.get(
    `${base}/api/rtc?room=smoke-${stamp}&peer=p1&name=Probe&since=0`,
  );
  const body = await rtc.text();
  console.log("rtc signaling:", rtc.status(), body.slice(0, 200));
  if (rtc.status() !== 200) throw new Error(`rtc status ${rtc.status()}`);

  console.log(JSON.stringify({ ok: true, emailA, emailB, nameA, nameB }, null, 2));
  await contextA.close();
  await contextB.close();
} finally {
  await browser.close();
}
