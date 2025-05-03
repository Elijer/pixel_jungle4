import { test, chromium, Browser, BrowserContext, Page } from '@playwright/test';

test('spam WASD in 16 simultaneous browsers', async () => {
  const url = 'https://pixel-jungle4.onrender.com/';
  const browsers: Browser[] = [];
  const contexts: BrowserContext[] = [];
  const pages: Page[] = [];

  const NUM_BROWSERS = 12;
  const COMMANDS_PER_SECOND = 5;
  const DELAY_MS = Math.floor(1000 / COMMANDS_PER_SECOND);
  const TEST_DURATION_MS = 600000; // Run for 60 seconds

  const keys = ['w', 'a', 's', 'd'];

  // Launch browsers and open pages
  for (let i = 0; i < NUM_BROWSERS; i++) {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);

    browsers.push(browser);
    contexts.push(context);
    pages.push(page);
  }

  const spamTasks = pages.map((page) => {
    return (async () => {
      const endTime = Date.now() + TEST_DURATION_MS;

      while (Date.now() < endTime) {
        const key = keys[Math.floor(Math.random() * keys.length)];
        const spamMode = Math.random() < 0.5 ? 'single' : 'burst';

        if (spamMode === 'single') {
          await page.keyboard.press(key);
        } else {
          for (let i = 0; i < 140; i++) {
            await page.keyboard.press(key);
          }
        }

        await new Promise((res) => setTimeout(res, DELAY_MS));
      }
    })();
  });

  // Run all spamming tasks in parallel
  await Promise.all(spamTasks);

  // Cleanup
  for (const browser of browsers) {
    await browser.close();
  }
});
