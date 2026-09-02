/**
 * @fileoverview Automated Test Suite for Phase 3 Mobile-First UI
 * Verifies HTML structure, includes, syntax and client-side logic.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('====================================================');
console.log('RUNNING PHASE 3 FRONTEND UI TEST SUITE');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${desc}`);
    console.error(`         ${err.message}`);
    failCount++;
  }
}

// 1. File existence tests
it('All 4 required UI HTML files exist', () => {
  const indexExists = fs.existsSync(path.join(__dirname, '../Index.html'));
  const stylesExists = fs.existsSync(path.join(__dirname, '../Styles.html'));
  const scriptsExists = fs.existsSync(path.join(__dirname, '../Scripts.html'));
  const componentsExists = fs.existsSync(path.join(__dirname, '../Components.html'));

  assert.strictEqual(indexExists, true, 'Index.html must exist');
  assert.strictEqual(stylesExists, true, 'Styles.html must exist');
  assert.strictEqual(scriptsExists, true, 'Scripts.html must exist');
  assert.strictEqual(componentsExists, true, 'Components.html must exist');
});

// 2. Index.html structure & template include tests
it('Index.html contains Apps Script include tags for Styles, Components, and Scripts', () => {
  const indexContent = fs.readFileSync(path.join(__dirname, '../Index.html'), 'utf8');
  assert.ok(indexContent.includes("include('Styles')"), 'Must include Styles');
  assert.ok(indexContent.includes("include('Components')"), 'Must include Components');
  assert.ok(indexContent.includes("include('Scripts')"), 'Must include Scripts');
  assert.ok(indexContent.includes('viewport'), 'Must contain viewport meta tag');
});

// 3. 5 Views Verification
it('Index.html contains containers for all 5 required views', () => {
  const indexContent = fs.readFileSync(path.join(__dirname, '../Index.html'), 'utf8');
  assert.ok(indexContent.includes('id="view-scoreboard"'), 'Must have scoreboard view');
  assert.ok(indexContent.includes('id="view-new-game"'), 'Must have new-game view');
  assert.ok(indexContent.includes('id="view-history"'), 'Must have history view');
  assert.ok(indexContent.includes('id="view-players"'), 'Must have players view');
  assert.ok(indexContent.includes('id="view-settings"'), 'Must have settings view');
});

// 4. Mobile-first CSS verification
it('Styles.html contains mobile-first CSS, custom properties, and touch-target minimums', () => {
  const stylesContent = fs.readFileSync(path.join(__dirname, '../Styles.html'), 'utf8');
  assert.ok(stylesContent.includes('--color-primary:'), 'Must define CSS variables');
  assert.ok(stylesContent.includes('--touch-target: 48px'), 'Must define minimum 48px touch target');
  assert.ok(stylesContent.includes('.app-nav'), 'Must contain bottom navigation styles');
  assert.ok(stylesContent.includes('prefers-reduced-motion'), 'Must support prefers-reduced-motion');
});

// 5. Scripts.html logic verification
it('Scripts.html contains appState, apiClient adapter, and fast quick buttons logic', () => {
  const scriptsContent = fs.readFileSync(path.join(__dirname, '../Scripts.html'), 'utf8');
  assert.ok(scriptsContent.includes('const appState ='), 'Must contain central appState');
  assert.ok(scriptsContent.includes('const apiClient ='), 'Must contain apiClient adapter');
  assert.ok(scriptsContent.includes('submitGame'), 'Must contain submitGame function');
  assert.ok(scriptsContent.includes('showToast'), 'Must contain showToast function');
  assert.ok(scriptsContent.includes('escapeHtml'), 'Must contain escapeHtml for XSS prevention');
});

// 6. Code.gs include helper verification
it('Code.gs contains include helper function and doGet HTML renderer', () => {
  const codeContent = fs.readFileSync(path.join(__dirname, '../Code.gs'), 'utf8');
  assert.ok(codeContent.includes('function include(filename)'), 'Code.gs must export include helper');
  assert.ok(codeContent.includes("createTemplateFromFile('Index')"), 'doGet must render Index template');
});

console.log('\n====================================================');
console.log(`PHASE 3 TESTS FINISHED: ${passCount} PASSED | ${failCount} FAILED`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
}
