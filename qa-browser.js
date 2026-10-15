const { chromium } = require('playwright');
const fs = require('fs');
fs.mkdirSync('qa-artifacts', { recursive: true });
const target = process.env.QA_URL || 'http://127.0.0.1/tarot/';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.EDGE_PATH || process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/api/reading', route => route.fulfill({
    status: 200,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify({
      model: 'gpt-5.6-luna',
      reading: '【接收确认】\n已确认问题与力量正位。\n【逐牌解读】\n力量正位强调温柔而稳定的自我调节。\n【牌阵串联】\n单张牌把重点集中在行动方式。\n【核心回答】\n本周不需要更用力，而需要更稳定。\n【行动建议】\n1. 选定一个优先事项。\n\n1. 每天推进三十分钟。\n【边界提醒】\n这是一项自我反思参考。',
    }),
  }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-spread="one"]').click();
  await page.locator('#tarotQuestion').fill('我本周最需要调整的行动重点是什么？');
  const setup = {
    title: await page.title(),
    questionCount: await page.locator('#questionCount').innerText(),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  };
  await page.screenshot({ path: 'qa-artifacts/qa-setup.png' });
  await page.locator('#startReadingBtn').click();
  await page.locator('#s-cut').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: '完成切牌' }).click();
  await page.locator('#s-pick').waitFor({ state: 'visible' });
  await page.locator('.fc[data-index]').first().click();
  await page.locator('#confirmPick').click();
  await page.locator('#s-read').waitFor({ state: 'visible' });
  await page.locator('#card0').click();
  await page.locator('#aiOutput h4').first().waitFor({ state: 'visible' });
  const result = {
    question: await page.locator('#askedQuestion').innerText(),
    headings: await page.locator('#aiOutput h4').allInnerTexts(),
    actionItems: await page.locator('#aiOutput h4').filter({ hasText: '行动建议' }).locator('xpath=following-sibling::ol[1]/li').count(),
    retryVisible: await page.locator('#aiRetry').isVisible(),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
  };
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = {
    overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    panelWidth: Math.round((await page.locator('#aiReading').boundingBox()).width),
  };
  await page.locator('#aiReading').screenshot({ path: 'qa-artifacts/qa-ai-mobile.png' });
  console.log(JSON.stringify({ setup, result, mobile, errors }, null, 2));
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
