const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  
  // Try to load auth state
  const authFile = 'tests/e2e/.auth/user.json';
  let context;
  
  try {
    const authData = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    if (authData.cookies && authData.cookies.length > 0) {
      context = await browser.newContext({ storageState: authFile });
      console.log('Using saved auth state');
    } else {
      context = await browser.newContext();
    }
  } catch {
    context = await browser.newContext();
  }
  
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  
  // Go to visual catalog
  await page.goto('http://localhost:3000/catalogs/visual');
  await page.waitForTimeout(3000);
  
  const url = page.url();
  console.log('Current URL:', url);
  
  if (url.includes('/login')) {
    console.log('NEED_LOGIN: App requires manual login');
    await browser.close();
    return;
  }
  
  // Screenshot visual catalog
  await page.screenshot({ path: 'screenshot-visual-catalog.png', fullPage: false });
  console.log('Screenshot taken: screenshot-visual-catalog.png');
  
  // Screenshot products catalog
  await page.goto('http://localhost:3000/catalogs/products');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-products.png', fullPage: false });
  
  // Screenshot bulk entry
  await page.goto('http://localhost:3000/inventory/bulk-entry');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot-bulk-entry.png', fullPage: false });
  
  await browser.close();
  console.log('Done');
})();
