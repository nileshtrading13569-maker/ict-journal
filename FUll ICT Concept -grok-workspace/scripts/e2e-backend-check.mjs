import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const stamp = Date.now();
const email = `e2e-${stamp}@example.com`;
const password = "BackendProof!2026";
const accountName = `Backend Proof ${stamp}`;

const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ??
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));

function log(step, extra = "") {
  console.log(`${step}${extra ? `: ${extra}` : ""}`);
}

try {
  await page.goto(`${base}/login`, { waitUntil: "networkidle" });
  log("login page", String(await page.getByText("Your desk, synced.").isVisible()));

  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByPlaceholder("Full name").fill("E2E Backend");
  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password (at least 8 characters)").fill(password);
  await page.getByRole("button", { name: /Create private account/ }).click();

  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await page.getByText("Cloud saved").waitFor({ timeout: 30_000 });
  log("signed up and cloud connected", email);

  await page.getByLabel("Open settings").click();
  const accountInput = page.getByLabel("Account name");
  await accountInput.waitFor({ timeout: 10_000 });
  await accountInput.fill(accountName);
  await page.keyboard.press("Escape");
  await page.getByText("Cloud saved").waitFor({ timeout: 30_000 });

  const localBefore = await page.evaluate(() => window.localStorage.getItem("ict-narrative-desk"));
  log("localStorage mirrors save", String(Boolean(localBefore && localBefore.includes("Backend Proof"))));

  // Drop the browser copy, keep the session cookie, then reload. Anything that
  // returns must have come from the server-side user_desk_state row.
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Cloud saved").waitFor({ timeout: 30_000 });
  await page.getByLabel("Open settings").click();
  const restored = await page.getByLabel("Account name").inputValue();
  log("server-restored account name", restored);
  if (restored !== accountName) throw new Error(`Expected "${accountName}", got "${restored}"`);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/login", { timeout: 30_000 });
  log("signed out", "ok");

  // Fresh browser profile = no cookies, no localStorage. If the desk comes back
  // here, it can only have come from the server-side user_desk_state row.
  const freshContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const freshPage = await freshContext.newPage();
  await freshPage.goto(`${base}/login`, { waitUntil: "networkidle" });
  await freshPage.getByPlaceholder("Email address").fill(email);
  await freshPage.getByPlaceholder("Password (at least 8 characters)").fill(password);
  await freshPage.getByRole("button", { name: "Sign in with email" }).click();
  await freshPage.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await freshPage.getByText("Cloud saved").waitFor({ timeout: 30_000 });
  await freshPage.getByLabel("Open settings").click();
  const freshProfileName = await freshPage.getByLabel("Account name").inputValue();
  log("fresh-profile restore", freshProfileName);
  if (freshProfileName !== accountName) {
    throw new Error(`Fresh profile expected "${accountName}", got "${freshProfileName}"`);
  }
  await freshContext.close();

  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password (at least 8 characters)").fill(password);
  await page.getByRole("button", { name: "Sign in with email" }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await page.getByText("Cloud saved").waitFor({ timeout: 30_000 });

  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Cloud saved").waitFor({ timeout: 30_000 });
  await page.getByLabel("Open settings").click();
  const afterSignIn = await page.getByLabel("Account name").inputValue();
  log("restored after sign-out/sign-in", afterSignIn);
  if (afterSignIn !== accountName) throw new Error(`Expected "${accountName}", got "${afterSignIn}"`);

  await page.screenshot({ path: "screenshots/e2e-backend-proof.png", fullPage: true });

  const relevantErrors = consoleErrors.filter((text) => !text.includes("favicon"));
  log("console errors", String(relevantErrors.length));
  if (relevantErrors.length) {
    console.error(relevantErrors.join("\n"));
    throw new Error("Browser console reported errors");
  }

  console.log(JSON.stringify({ ok: true, email, accountName }, null, 2));
} finally {
  await browser.close();
}
