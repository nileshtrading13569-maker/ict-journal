import { chromium } from "playwright";

const CHROME =
  process.env.CHROME_PATH ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const firstGoogle = new Promise((resolve) => {
  page.on("request", (req) => {
    const u = req.url();
    if (u.startsWith("https://accounts.google.com/")) resolve(u);
  });
});

await page.goto("http://127.0.0.1:8090/login", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /Continue with Google/ }).click();
const url = new URL(await firstGoogle);
console.log("first google request host:", url.host);
console.log("client_id:", url.searchParams.get("client_id"));
console.log("redirect_uri:", url.searchParams.get("redirect_uri"));
console.log("scope:", url.searchParams.get("scope"));
console.log("has state:", Boolean(url.searchParams.get("state")));

// The first-party button must not go through the broker.
const broker = new Promise((resolve) => {
  page.on("request", (req) => {
    if (req.url().includes("auth.grok.me")) resolve(req.url());
  });
  setTimeout(() => resolve(null), 1200);
});
console.log("broker request:", (await broker)?.slice(0, 80) ?? "none");

await browser.close();
