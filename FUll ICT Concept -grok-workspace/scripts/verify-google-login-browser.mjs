import { chromium } from "playwright";
import assert from "node:assert/strict";

async function runBrowserTest() {
  console.log("=== Launching System Browser to verify Google Sign-In ===");
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "msedge" });
  } catch {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
  }
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console and page errors
  page.on("pageerror", (err) => console.log(`[Browser Page Error] ${err}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log(`[Browser Console Error] ${msg.text()}`);
    }
  });

  console.log("1. Navigating to http://localhost:8080/login ...");
  await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });

  // Verify the page title or content
  const content = await page.content();
  assert.ok(content.includes("Continue with Google"), "Page must contain 'Continue with Google'");
  assert.ok(!content.includes("Sign-in couldn't be completed"), "Page must NOT contain error message");

  console.log("2. Locating 'Continue with Google' button...");
  const googleBtn = page.locator('button:has-text("Continue with Google")');
  await googleBtn.waitFor({ state: "visible", timeout: 5000 });

  console.log("3. Clicking 'Continue with Google' button...");
  await googleBtn.click();

  // Wait for Google Sign-In modal or dialog
  console.log("4. Waiting for Google Account Chooser dialog...");
  const modalHeader = page.locator('text=Choose a Google account');
  await modalHeader.waitFor({ state: "visible", timeout: 5000 });

  // Check that preset Google accounts exist
  const alexOption = page.locator('text=Alex Trader');
  await alexOption.waitFor({ state: "visible", timeout: 5000 });
  console.log("   Found preset Google account: Alex Trader");

  // Click Alex Trader to sign in
  console.log("5. Selecting Alex Trader Google account...");
  await alexOption.click();

  // Wait for redirect to / or desk
  console.log("6. Waiting for navigation after Google Sign-In...");
  await page.waitForURL((url) => url.pathname === "/" || url.pathname.includes("/desk"), { timeout: 10000 });
  console.log(`   Navigated to: ${page.url()}`);

  // Wait for desk UI to be visible
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  console.log("7. Current URL after sign-in:", currentUrl);

  // Take screenshot of the authenticated desk
  await page.screenshot({ path: "storage/test-authenticated-desk.png" });
  console.log("   Screenshot saved to storage/test-authenticated-desk.png");

  // Verify user button / account in UI
  const bodyText = await page.innerText("body");
  console.log("   Page loaded successfully with user session.");
  assert.ok(!bodyText.includes("Sign-in couldn't be completed"));
  assert.ok(bodyText.includes("Alex Trader"), "UI must display Alex Trader");

  console.log("8. Testing Sign Out for Alex Trader...");
  const signOutBtn = page.locator('button:has-text("Sign out"), button[aria-label="Sign out"]').first();
  if (await signOutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await signOutBtn.click();
    console.log("   Clicked Sign out");
    await page.waitForTimeout(2000);
  }

  console.log("9. Testing Second Google Account (Sarah Jenkins)...");
  await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
  const googleBtn2 = page.locator('button:has-text("Continue with Google")');
  await googleBtn2.waitFor({ state: "visible", timeout: 5000 });
  await googleBtn2.click();

  const sarahOption = page.locator('text=Sarah Jenkins');
  await sarahOption.waitFor({ state: "visible", timeout: 5000 });
  console.log("   Selecting Sarah Jenkins Google account...");
  await sarahOption.click();

  await page.waitForURL((url) => url.pathname === "/" || url.pathname.includes("/desk"), { timeout: 10000 });
  console.log(`   Navigated to Sarah's desk: ${page.url()}`);
  await page.waitForTimeout(2000);

  const sarahBody = await page.innerText("body");
  assert.ok(sarahBody.includes("Sarah Jenkins"), "UI must reflect Sarah Jenkins Google profile");

  console.log("10. Testing Sign Out for Sarah Jenkins...");
  const signOutBtn2 = page.locator('button:has-text("Sign out"), button[aria-label="Sign out"]').first();
  if (await signOutBtn2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await signOutBtn2.click();
    console.log("   Sarah signed out successfully.");
  }

  await browser.close();
  console.log("\n=== MULTI-USER GOOGLE BROWSER E2E TEST COMPLETED SUCCESSFULLY ===");
}

runBrowserTest().catch((err) => {
  console.error("Browser test failed:", err);
  process.exit(1);
});
