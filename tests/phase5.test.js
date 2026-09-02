/**
 * @fileoverview phase5.test.js - Phase 5 Integration, Performance, Multi-Device Protection & Branding Test Suite
 * Run via: node tests/phase5.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock Spreadsheet Environment for Apps Script
class MockRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row;
    this.col = col;
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getValues() {
    const result = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowArr = [];
      for (let c = 0; c < this.numCols; c++) {
        const cellVal = this.sheet.data[this.row - 1 + r]
          ? this.sheet.data[this.row - 1 + r][this.col - 1 + c]
          : '';
        rowArr.push(cellVal !== undefined ? cellVal : '');
      }
      result.push(rowArr);
    }
    return result;
  }

  getValue() {
    const vals = this.getValues();
    return vals[0] ? vals[0][0] : '';
  }

  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const targetRow = this.row - 1 + r;
      if (!this.sheet.data[targetRow]) {
        this.sheet.data[targetRow] = [];
      }
      for (let c = 0; c < values[r].length; c++) {
        this.sheet.data[targetRow][this.col - 1 + c] = values[r][c];
      }
    }
    return this;
  }

  setValue(val) {
    return this.setValues([[val]]);
  }

  setFontWeight() { return this; }
  setBackground() { return this; }
  clearContent() {
    for (let r = 0; r < this.numRows; r++) {
      const targetRow = this.row - 1 + r;
      if (this.sheet.data[targetRow]) {
        for (let c = 0; c < this.numCols; c++) {
          this.sheet.data[targetRow][this.col - 1 + c] = '';
        }
      }
    }
    return this;
  }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
  }

  getName() { return this.name; }

  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) {
      if (this.data[i] && this.data[i].some((cell) => cell !== '' && cell !== undefined && cell !== null)) {
        return i + 1;
      }
    }
    return 0;
  }

  getLastColumn() {
    let maxCol = 0;
    for (const row of this.data) {
      if (row) {
        for (let c = row.length - 1; c >= 0; c--) {
          if (row[c] !== '' && row[c] !== undefined && row[c] !== null) {
            if (c + 1 > maxCol) maxCol = c + 1;
            break;
          }
        }
      }
    }
    return maxCol;
  }

  getRange(row, col, numRows = 1, numCols = 1) {
    return new MockRange(this, row, col, numRows, numCols);
  }

  appendRow(rowValues) {
    const nextRow = this.getLastRow() + 1;
    this.getRange(nextRow, 1, 1, rowValues.length).setValues([rowValues]);
    return this;
  }

  setFrozenRows() { return this; }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = new Map();
    this.name = 'Chốt Điểm Testing Sheet';
    this.id = 'MOCK_SS_PHASE5_ID';
  }

  getId() { return this.id; }
  getName() { return this.name; }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) {
    const s = new MockSheet(name);
    this.sheets.set(name, s);
    return s;
  }
  getSheets() { return Array.from(this.sheets.values()); }
}

class MockLock {
  constructor() { this.locked = false; }
  tryLock() { this.locked = true; return true; }
  releaseLock() { this.locked = false; }
}

// Inject Globals
const mockSpreadsheetInstance = new MockSpreadsheet();
global.SpreadsheetApp = {
  getActiveSpreadsheet: () => mockSpreadsheetInstance,
  openById: () => mockSpreadsheetInstance
};

const mockLockInstance = new MockLock();
global.LockService = {
  getDocumentLock: () => mockLockInstance,
  getScriptLock: () => mockLockInstance
};

require.extensions['.gs'] = require.extensions['.js'];

const CONFIG = require('../Config.gs');
global.CONFIG = CONFIG;

const Utils = require('../Utils.gs');
Object.assign(global, Utils);

const PlayerService = require('../PlayerService.gs');
Object.assign(global, PlayerService);

const SummaryService = require('../SummaryService.gs');
Object.assign(global, SummaryService);

const GameService = require('../GameService.gs');
Object.assign(global, GameService);

const Code = require('../Code.gs');
Object.assign(global, Code);

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

console.log('====================================================');
console.log('RUNNING PHASE 5 INTEGRATION & OPTIMIZATION TEST SUITE');
console.log('====================================================\n');

// 1. SETUP & BRANDING INITIALIZATION
console.log('--- 1. Setup, Branding & Metadata ---');
it('setupApp initializes 5 sheets and stores official slogan in CAU_HINH', () => {
  const res = setupApp({
    sessionName: 'Phiên Chơi Phase 5',
    defaultBet: 5
  });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.success, true);

  const status = getAppStatus();
  assert.strictEqual(status.ok, true);
  assert.strictEqual(status.data.appName, 'Chốt Điểm');
  assert.strictEqual(status.data.slogan, 'Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.');
});

// 2. BOOTSTRAP API & PERFORMANCE
console.log('\n--- 2. Task 5.2: High-Speed Bootstrap API & Cache ---');
it('getAppBootstrapData returns comprehensive snapshot in a single call', () => {
  // Add seed players
  addPlayer('Đào');
  addPlayer('Tiến');
  addPlayer('Bình');

  const bootRes = getAppBootstrapData();
  assert.strictEqual(bootRes.ok, true);
  assert.strictEqual(bootRes.success, true);
  assert.strictEqual(bootRes.data.session.appName, 'Chốt Điểm');
  assert.strictEqual(bootRes.data.session.slogan, 'Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.');
  assert.strictEqual(bootRes.data.players.length, 3);
  assert.strictEqual(bootRes.data.latestGameNumber, 0);
  assert.ok(Array.isArray(bootRes.data.scoreboard));
  assert.ok(Array.isArray(bootRes.data.recentGames));
});

it('PlayerService uses Cache and automatically invalidates on mutation', () => {
  const cached1 = getPlayers();
  assert.strictEqual(cached1.ok, true);
  assert.strictEqual(cached1.data.length, 3);

  // Add new player -> Invalidate cache
  addPlayer('An');
  const cached2 = getPlayers();
  assert.strictEqual(cached2.ok, true);
  assert.strictEqual(cached2.data.length, 4);
});

// 3. TASK 5.1 & TASK 5.3: MULTI-DEVICE CONCURRENCY & STALE_DATA PROTECTION
console.log('\n--- 3. Task 5.1 & 5.3: Multi-Device Concurrency & STALE_DATA ---');
it('Device A successfully saves Game 1 and advances latestGameNumber to 1', () => {
  const saveResA = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'WIN', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 5 },
      { playerId: 'P004', result: 'DRAW', bet: 5 }
    ],
    expectedLatestGameNumber: 0,
    requestId: 'REQ-DEV-A-001'
  });

  assert.strictEqual(saveResA.ok, true);
  assert.strictEqual(saveResA.data.game.gameNumber, 1);
  assert.strictEqual(saveResA.data.latestGameNumber, 1);
  assert.strictEqual(saveResA.meta.latestGameNumber, 1);
});

it('Device B tries to save with stale expectedLatestGameNumber=0 and gets STALE_DATA error', () => {
  const saveResB = saveGame({
    leaderId: 'P002',
    defaultBet: 5,
    opponents: [
      { playerId: 'P001', result: 'WIN', bet: 5 },
      { playerId: 'P003', result: 'WIN', bet: 5 }
    ],
    expectedLatestGameNumber: 0, // Stale! Actual latest is 1
    requestId: 'REQ-DEV-B-001'
  });

  assert.strictEqual(saveResB.ok, false);
  assert.strictEqual(saveResB.errorCode, 'STALE_DATA');
  assert.strictEqual(saveResB.meta.latestGameNumber, 1);
});

it('Device B refreshes to latestGameNumber=1 and successfully saves Game 2', () => {
  const saveResB2 = saveGame({
    leaderId: 'P002',
    defaultBet: 5,
    opponents: [
      { playerId: 'P001', result: 'WIN', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 5 }
    ],
    expectedLatestGameNumber: 1, // Refreshed to match actual
    requestId: 'REQ-DEV-B-002'
  });

  assert.strictEqual(saveResB2.ok, true);
  assert.strictEqual(saveResB2.data.game.gameNumber, 2);
  assert.strictEqual(saveResB2.data.latestGameNumber, 2);
});

// 4. TASK 5.3: IDEMPOTENCY / ANTI-DUPLICATE PROTECTION
console.log('\n--- 4. Task 5.3: Anti-Duplicate Submission (Idempotency) ---');
it('Submitting same requestId returns existing game result without appending duplicate rows', () => {
  const roundSheet = mockSpreadsheetInstance.getSheetByName('VAN_DAU');
  const initialRowCount = roundSheet.getLastRow();

  const dupRes = saveGame({
    leaderId: 'P002',
    defaultBet: 5,
    opponents: [
      { playerId: 'P001', result: 'WIN', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 5 }
    ],
    expectedLatestGameNumber: 2,
    requestId: 'REQ-DEV-B-002' // Same requestId as previous
  });

  assert.strictEqual(dupRes.ok, true);
  assert.strictEqual(dupRes.data.isDuplicate, true);

  const finalRowCount = roundSheet.getLastRow();
  assert.strictEqual(finalRowCount, initialRowCount, 'Duplicate request must NOT append new row');
});

// 5. TASK 5.4: BRANDING & UI INTEGRITY
console.log('\n--- 5. Task 5.4: Branding & UI Code Check ---');
it('Index.html and Styles.html contain official App Name, Slogan, Splash Screen and Color Variables', () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, '../Index.html'), 'utf-8');
  const stylesHtml = fs.readFileSync(path.join(__dirname, '../Styles.html'), 'utf-8');
  const componentsHtml = fs.readFileSync(path.join(__dirname, '../Components.html'), 'utf-8');
  const scriptsHtml = fs.readFileSync(path.join(__dirname, '../Scripts.html'), 'utf-8');

  // Name & Slogan
  assert.ok(indexHtml.includes('Chốt Điểm'));
  assert.ok(indexHtml.includes('Chạm nhanh, tính chuẩn, vui trọn cuộc chơi.'));

  // Splash Screen
  assert.ok(indexHtml.includes('id="splash-screen"'));
  assert.ok(stylesHtml.includes('.splash-screen'));

  // Multi-device modal & Sync
  assert.ok(indexHtml.includes('id="modal-stale-data"'));
  assert.ok(stylesHtml.includes('.top-bar__sync-wrap'));

  // Logo & SVG Icons
  assert.ok(componentsHtml.includes('id="app-logo-svg"'));
  assert.ok(componentsHtml.includes('id="icon-win"'));
  assert.ok(componentsHtml.includes('id="icon-draw"'));
  assert.ok(componentsHtml.includes('id="icon-lose"'));

  // CSS Color tokens
  assert.ok(stylesHtml.includes('--color-win:'));
  assert.ok(stylesHtml.includes('--color-draw:'));
  assert.ok(stylesHtml.includes('--color-lose:'));
  assert.ok(stylesHtml.includes('--color-background:'));

  // Central GasClient
  assert.ok(scriptsHtml.includes('const GasClient'));
  assert.ok(scriptsHtml.includes('bootstrapApp'));
  assert.ok(scriptsHtml.includes('refreshAppData'));
});

// 6. TOTAL SESSION ZERO-SUM CHECK
console.log('\n--- 6. Mathematical Invariant Verification ---');
it('Session Total Score across all players remains exactly 0', () => {
  const sbRes = getScoreboard();
  assert.strictEqual(sbRes.ok, true);
  const total = sbRes.data.reduce((sum, p) => sum + p.totalScore, 0);
  assert.strictEqual(total, 0, `Total session score must be 0, got ${total}`);
});

console.log('\n====================================================');
console.log(`PHASE 5 TESTS FINISHED: ${passCount} PASSED | ${failCount} FAILED`);
console.log('====================================================\n');

if (failCount > 0) {
  process.exit(1);
}
