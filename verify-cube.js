const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();

  const screenshots = [];
  async function shot(label) {
    const p = `C:\\Temp\\cube-${label}.png`;
    await page.screenshot({ path: p, fullPage: false });
    screenshots.push(label);
    console.log(`[shot] ${label}`);
  }

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', e => errors.push(String(e)));

  console.log('→ Loading page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(2500); // let Three.js + React hydrate

  // Close tutorial panel if present (it has a "Close Tutorial" button)
  const closeBtn = page.locator('button', { hasText: 'Close Tutorial' });
  if (await closeBtn.isVisible().catch(() => false)) {
    console.log('→ Closing tutorial panel...');
    await closeBtn.click();
    await page.waitForTimeout(400);
  }

  await shot('01-initial');

  // Move buttons use class min-w-[2.5rem] and are in .font-mono — exact text match
  // Use getByRole + exact name to avoid partial matches like "U" matching "Close Tutorial"
  async function clickMoveBtn(name, waitMs = 1500) {
    // The move buttons are in the MoveButtons component at the bottom
    // They have font-mono class and exact text. Use a stricter locator.
    const btn = page.locator('.font-mono').filter({ hasText: new RegExp(`^${name.replace("'", "\\'")}$`) }).first();
    await btn.waitFor({ state: 'visible', timeout: 6000 });
    await btn.click();
    await page.waitForTimeout(waitMs);
  }

  // ── Test 1: F move ──
  console.log('[TEST 1] F move...');
  await clickMoveBtn('F');
  await shot('02-after-F');

  // ── Test 2: F' move ──
  console.log('[TEST 2] F\' move...');
  await clickMoveBtn("F'");
  await shot('03-after-Fprime');

  // check back to solved visually (F then F' should restore)
  // ── Test 3: Scramble R U F' D L B ──
  console.log('[TEST 3] Scramble: R U F\' D L B...');
  for (const m of ['R', 'U', "F'", 'D', 'L', 'B']) {
    await clickMoveBtn(m, 1200);
  }
  await shot('04-after-scramble');

  // ── Test 4: Reset ──
  console.log('[TEST 4] Reset...');
  await page.locator('button', { hasText: 'Reset' }).click();
  await page.waitForTimeout(1200);
  await shot('05-after-reset');

  // ── Probe: rapid-fire two moves while isAnimating ──
  console.log('[PROBE] rapid F + F\' back-to-back...');
  await clickMoveBtn('F', 0);
  await clickMoveBtn("F'", 0);
  await page.waitForTimeout(3000);
  await shot('06-probe-rapid');

  console.log('\n── RESULT ──');
  console.log('Screenshots: ' + screenshots.map(s => `C:\\Temp\\cube-${s}.png`).join(', '));
  if (errors.length) {
    console.log('JS ERRORS:');
    errors.forEach(e => console.log('  ' + e));
  } else {
    console.log('No JS errors.');
  }

  await browser.close();
})();
