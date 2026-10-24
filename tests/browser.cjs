// Optional browser regression suite: requires Playwright and installed Chrome or Edge.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
const executablePath = process.env.BROWSER_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(file => fs.existsSync(file));

async function main() {
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.stack); });
  page.on('requestfailed', request => errors.push(request.url() + ': ' + request.failure()?.errorText));
  const fileUrl = pathToFileURL(path.join(root, 'index.html')).href;
  const position = () => page.evaluate(() => {
    const { GAME, VIZ } = HandClash.state;
    return { hands: GAME.hands, current: GAME.current, editable: GAME.editable,
      running: GAME.running, gameOver: GAME.gameOver, humanSide: GAME.humanSide,
      key: HandClash.tree.currentKey(), scale: VIZ.scale, path: VIZ.pathKeys };
  });
  const waitForHuman = () => page.waitForFunction(() => HandClash.game.isHumanTurnForBoard());
  const click = selector => page.locator(selector).click();
  let server;
  try {
    await page.goto(fileUrl);
    await page.waitForFunction(() => window.HandClash?.state.GAME.editable);
    for (let value = 1; value <= 10; value++) {
      await page.waitForFunction(() => {
        const image = document.getElementById('imgMe_0');
        return image.complete && image.naturalWidth > 0;
      });
      assert.match(await page.locator('#imgMe_0').getAttribute('src'), new RegExp(`hand${value}\\.jpg$`));
      await click('#me_0');
    }
    console.log('PASS all ten hand photos and numeric mapping');
    assert.equal(await page.locator('#nodeLayer .node-g').count(), 1);
    // Four distinct first-row states must not spread out as their children expand.
    await click('#me_1');
    await click('#opp_1');
    await click('#opp_1');
    await click('#nodeLayer .node-rect.current');
    const firstRowBefore = await page.evaluate(() => {
      const { VIZ, table } = HandClash.state;
      return [...new Set(table[VIZ.rootKey].childs)].map(key => [key, VIZ.nodePos.get(key)]);
    });
    assert.equal(firstRowBefore.length, 4);
    for (const [key] of firstRowBefore) {
      await page.locator(`#nodeLayer .node-g[data-state="${key}"] .node-rect`).click();
    }
    const firstRowAfter = await page.evaluate(keys => keys.map(key => [key, HandClash.state.VIZ.nodePos.get(key)]), firstRowBefore.map(([key]) => key));
    assert.deepEqual(firstRowAfter, firstRowBefore);
    assert.equal(firstRowAfter[3][1].x - firstRowAfter[0][1].x, 3 * (78 + 14));
    const renderCounts = await page.evaluate(() => {
      const { VIZ, table } = HandClash.state;
      const graph = HandClash.layout.buildVisibleGraph(table, VIZ.rootKey, VIZ.expanded, VIZ.hidden);
      return [graph.nodes.size, document.querySelectorAll('.node-g').length,
        graph.edges.length, document.querySelectorAll('#edgeLayer line').length];
    });
    assert.equal(renderCounts[0], renderCounts[1]);
    assert.equal(renderCounts[2], renderCounts[3]);
    await click('#btnFit');
    await page.waitForFunction(() => !document.getElementById('edgeLayer').classList.contains('hidden'));
    await page.screenshot({ path: path.join(root, 'tests/layout.png'), animations: 'disabled' });
    await page.evaluate(() => HandClash.game.resetToIdle());
    console.log('PASS four compact root children, expanded graph, and unique SVG nodes and edges');
    await click('#me_0');
    assert.equal((await position()).hands.A[0], 2);
    assert.equal((await position()).key, '0:2,1,1,1');
    await click('#me_0');
    await click('#btnMain');
    await click('#me_0');
    await click('#opp_0');
    await waitForHuman();
    assert.equal((await position()).hands.A[0], 4);
    await click('#btnBack');
    assert.deepEqual((await position()).hands, { A: [3, 1], B: [1, 1] });
    assert.equal((await position()).path.length, 1);
    console.log('PASS file://, custom start, board move, best AI, and undo');

    // Tree choice must produce the exact same transition as a board move.
    await click('#nodeLayer .node-rect.current');
    const child = await page.evaluate(() => {
      const key = HandClash.tree.currentKey();
      const move = HandClash.state.table[key].childs.findIndex(Boolean);
      return { key: HandClash.state.table[key].childs[move], move };
    });
    await page.locator('.select-btn').first().click();
    await waitForHuman();
    assert.equal((await position()).path[1], child.key);
    console.log('PASS SVG tree move and AI response');

    // Undo during an AI animation must prevent the old continuation from committing.
    await click('#me_0');
    await click('#opp_0');
    await page.waitForFunction(() => HandClash.state.GAME.aiActing);
    await click('#btnBack');
    const restored = await position();
    await page.waitForTimeout(1200);
    assert.deepEqual((await position()).hands, restored.hands);
    assert.equal((await position()).current, restored.current);
    console.log('PASS undo cancels an in-flight AI turn');

    // Restart while an old AI animation is still in progress, then immediately start a new game.
    await click('#btnMain');
    await click('[data-side="B"]');
    await click('[data-strat="random"]');
    await click('#btnMain');
    await page.waitForFunction(() => HandClash.state.GAME.aiActing);
    await click('#btnMain');
    await click('[data-side="A"]');
    await click('#btnMain');
    await page.waitForTimeout(1200);
    assert.deepEqual((await position()).hands, { A: [1, 1], B: [1, 1] });
    assert.equal((await position()).current, 'A');
    console.log('PASS restart cancels old animation across a new game');

    await click('#btnMain');
    await click('[data-side="B"]');
    await click('#btnMain');
    await waitForHuman();
    assert.equal((await position()).current, 'B');
    assert.equal(await page.locator('#roleMe1').textContent(), 'B 手1 (你)');
    console.log('PASS second player and random AI');

    // A custom terminal opening must end immediately; a winning move remains undoable.
    await click('#btnMain');
    await click('[data-side="A"]');
    for (let n = 0; n < 9; n++) await click('#me_0');
    for (let n = 0; n < 8; n++) await click('#me_1');
    await click('#btnMain');
    await click('#me_1');
    await click('#opp_0');
    assert.equal((await position()).gameOver, true);
    assert.match(await page.locator('#status').textContent(), /你获胜/);
    assert.equal((await position()).key, '1:10,10,1,1');
    await click('#btnBack');
    assert.deepEqual((await position()).hands.A, [10, 9]);
    await click('#btnMain');
    for (const selector of ['#me_0', '#me_1']) {
      for (let n = 0; n < 9; n++) await click(selector);
    }
    await click('#btnMain');
    assert.equal((await position()).gameOver, true);
    console.log('PASS win, final tree position, terminal opening, and undo after win');

    await click('#btnZoomIn');
    assert.ok((await position()).scale > 1);
    await click('#btnFit');
    await click('#btnResetView');
    assert.equal((await position()).scale, 1);
    await click('#btnHelp');
    assert.equal(await page.locator('#helpMask').getAttribute('class'), 'help-mask show');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#helpMask').getAttribute('class'), 'help-mask');
    const before = await page.locator('#vizRoot').getAttribute('transform');
    const box = await page.locator('#vizSvg').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height - 50);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height - 20);
    await page.mouse.up();
    assert.notEqual(await page.locator('#vizRoot').getAttribute('transform'), before);
    console.log('PASS zoom, fit, reset, help, and drag');

    await page.setViewportSize({ width: 390, height: 844 });
    await click('#btnMain');
    await page.screenshot({ path: path.join(root, 'tests/mobile.png') });
    assert.ok((await page.locator('#vizArea').boundingBox()).height > 100);
    assert.equal(await page.locator('body').evaluate(el => el.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.screenshot({ path: path.join(root, 'tests/desktop.png') });
    console.log('PASS mobile and desktop layout');

    server = http.createServer((req, res) => {
      const target = path.join(root, req.url === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
      const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg' };
      if (!target.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
      fs.readFile(target, (error, data) => {
        if (error) { res.writeHead(404).end(); return; }
        res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
        res.end(data);
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.HandClash?.state.GAME.editable);
    await click('#btnMain');
    await click('#me_0');
    await click('#opp_0');
    await waitForHuman();
    assert.equal((await position()).hands.A[0], 2);
    assert.deepEqual(errors, []);
    console.log('PASS HTTP mode and no script errors or failed requests');
  } catch (error) {
    console.error('Position at failure:', await position().catch(() => null));
    console.error('Status:', await page.locator('#status').textContent().catch(() => null));
    throw error;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
