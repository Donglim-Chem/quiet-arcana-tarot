const { chromium } = require('playwright');
const fs = require('fs');
fs.mkdirSync('qa-artifacts', { recursive: true });

const target = process.env.QA_URL || 'http://127.0.0.1:8091/';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.EDGE_PATH || process.env.CHROME_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  let aiRequests = 0;

  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem('tarot_history_v1', JSON.stringify([
      {
        id: 'new-reading',
        t: Date.now(),
        spread: '单张牌',
        spreadKey: 'one',
        variantKey: 'classic',
        q: '我本周最需要调整的行动重点是什么？',
        cards: [{ p: '指引', n: '力量', r: false }],
        aiReading: '【核心回答】\n先稳住节奏，再集中处理最重要的一件事。',
        aiModel: 'gpt-5.6-luna',
      },
      {
        t: Date.now() - 60000,
        spread: '三张牌',
        cards: [
          { p: '过去', n: '愚者', r: false },
          { p: '现在', n: '魔术师', r: true },
          { p: '未来', n: '女祭司', r: false },
        ],
      },
    ]));
  });
  await page.route('**/api/reading', route => {
    aiRequests++;
    return route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        model: 'gpt-5.6-luna',
        reading: '【核心回答】\n这是重新生成并保存到原记录的解读。',
      }),
    });
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(target, { waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: '占卜记录' }).click();
  await page.screenshot({ path: 'qa-artifacts/qa-history-list.png' });
  const historyButtons = page.locator('[data-history-id]');
  const initialCount = await historyButtons.count();
  await historyButtons.filter({ hasText: '单张牌' }).click();
  await page.waitForTimeout(20);
  const newRestore = {
    question: await page.locator('#askedQuestion').innerText(),
    cardCount: await page.locator('#board .card.done').count(),
    reading: await page.locator('#aiOutput').innerText(),
    aiRequests,
    historyCount: JSON.parse(await page.evaluate(() => localStorage.getItem('tarot_history_v1'))).length,
  };

  await page.locator('#aiRetry').click();
  await page.getByText('这是重新生成并保存到原记录的解读。').waitFor();
  const afterRetryRecords = JSON.parse(await page.evaluate(() => localStorage.getItem('tarot_history_v1')));
  const retry = {
    aiRequests,
    historyCount: afterRetryRecords.length,
    updatedSameRecord: afterRetryRecords.find(record => record.id === 'new-reading')?.aiReading.includes('重新生成'),
  };

  await page.getByRole('button', { name: '占卜记录' }).click();
  await page.locator('[data-history-id]').filter({ hasText: '三张牌' }).click();
  await page.waitForTimeout(20);
  const legacyRestore = {
    title: await page.locator('#readTitle').innerText(),
    cardCount: await page.locator('#board .card.done').count(),
    localReadingCount: await page.locator('#readings .rd').count(),
    orientations: await page.locator('#board .card.done').evaluateAll(cards => cards.map(card => card.getAttribute('aria-label'))),
    status: await page.locator('#aiStatus').innerText(),
    retryVisible: await page.locator('#aiRetry').isVisible(),
    aiRequests,
    historyCount: JSON.parse(await page.evaluate(() => localStorage.getItem('tarot_history_v1'))).length,
  };
  const mobile = {
    pageOverflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    boardOverflow: await page.locator('#board').evaluate(el => el.scrollWidth > el.clientWidth),
  };
  await page.screenshot({ path: 'qa-artifacts/qa-history-restored.png', fullPage: true });

  const checks = {
    initialCount: initialCount === 2,
    newRecordRestored: newRestore.question.includes('本周') && newRestore.cardCount === 1 && newRestore.reading.includes('先稳住节奏'),
    restoreDidNotRequestAI: newRestore.aiRequests === 0,
    restoreDidNotDuplicate: newRestore.historyCount === 2,
    retryUpdatedSameRecord: retry.aiRequests === 1 && retry.historyCount === 2 && retry.updatedSameRecord,
    legacyRecordRestored: legacyRestore.title === '三张牌' && legacyRestore.cardCount === 3 && legacyRestore.localReadingCount === 3,
    legacyOrientationRestored: legacyRestore.orientations.some(label => label.includes('魔术师，逆位')),
    legacyDidNotRequestAI: legacyRestore.aiRequests === 1,
    legacyDidNotDuplicate: legacyRestore.historyCount === 2,
    legacyMessageShown: legacyRestore.status.includes('早期记录') && !legacyRestore.retryVisible,
    noMobileOverflow: !mobile.pageOverflow && !mobile.boardOverflow,
    noBrowserErrors: errors.length === 0,
  };
  console.log(JSON.stringify({ target, checks, newRestore, retry, legacyRestore, mobile, errors }, null, 2));
  await browser.close();
  if (Object.values(checks).some(value => !value)) process.exit(1);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
