/**
 * @fileoverview Automated Test Suite for Phase 2 Backend Services (Node.js Environment)
 * Includes in-memory Google Apps Script SpreadsheetApp & LockService Mock Engine.
 */

const assert = require('assert');

// Global mock engine for Apps Script
class MockRange {
  constructor(sheet, row, col, numRows, numCols) {
    this.sheet = sheet;
    this.row = row; // 1-based
    this.col = col; // 1-based
    this.numRows = numRows;
    this.numCols = numCols;
  }

  getValues() {
    const res = [];
    for (let r = 0; r < this.numRows; r++) {
      const rowIdx = this.row - 1 + r;
      const rowData = [];
      for (let c = 0; c < this.numCols; c++) {
        const colIdx = this.col - 1 + c;
        const val = (this.sheet.grid[rowIdx] && this.sheet.grid[rowIdx][colIdx] !== undefined)
          ? this.sheet.grid[rowIdx][colIdx]
          : '';
        rowData.push(val);
      }
      res.push(rowData);
    }
    return res;
  }

  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const rowIdx = this.row - 1 + r;
      if (!this.sheet.grid[rowIdx]) {
        this.sheet.grid[rowIdx] = [];
      }
      for (let c = 0; c < values[r].length; c++) {
        const colIdx = this.col - 1 + c;
        this.sheet.grid[rowIdx][colIdx] = values[r][c];
      }
    }
    return this;
  }

  setFontWeight() { return this; }
  setBackground() { return this; }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.grid = []; // 2D array [row][col]
    this.frozenRows = 0;
  }

  getName() { return this.name; }
  setFrozenRows(n) { this.frozenRows = n; }

  getLastRow() {
    return this.grid.length;
  }

  getLastColumn() {
    let maxCol = 0;
    for (const row of this.grid) {
      if (row && row.length > maxCol) {
        maxCol = row.length;
      }
    }
    return maxCol;
  }

  getRange(row, col, numRows = 1, numCols = 1) {
    return new MockRange(this, row, col, numRows, numCols);
  }

  appendRow(rowValues) {
    this.grid.push([...rowValues]);
    return this;
  }

  clearContents() {
    this.grid = [];
    return this;
  }
}

class MockSpreadsheet {
  constructor(id = 'test-spreadsheet-id', name = 'Chốt Điểm Test Spreadsheet') {
    this.id = id;
    this.name = name;
    this.sheets = new Map();
  }

  getId() { return this.id; }
  getName() { return this.name; }

  getSheetByName(name) {
    return this.sheets.get(name) || null;
  }

  insertSheet(name) {
    const sheet = new MockSheet(name);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

class MockLock {
  constructor() {
    this.locked = false;
  }
  tryLock() {
    this.locked = true;
    return true;
  }
  releaseLock() {
    this.locked = false;
  }
}

// Inject globals for Apps Script files
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

// Register .gs extension support for Node.js require
require.extensions['.gs'] = require.extensions['.js'];

// Load backend services
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

// Test Runner
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
console.log('RUNNING PHASE 2 BACKEND COMPREHENSIVE TEST SUITE');
console.log('====================================================\n');

// 1. SETUP APP TESTS
console.log('--- 1. setupApp() & Initialization ---');
it('setupApp initializes 4 sheets with correct headers & default config', () => {
  const res = setupApp({ sessionName: 'Test Session', defaultBet: 5 });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.data.createdSheets.length, 4);

  const status = getAppStatus();
  assert.strictEqual(status.ok, true);
  assert.strictEqual(status.data.appName, 'Chốt Điểm');
  assert.strictEqual(status.data.sessionName, 'Test Session');
  assert.strictEqual(status.data.defaultBet, 5);
});

it('setupApp is idempotent on subsequent runs without overwriting or duplicating', () => {
  const res2 = setupApp();
  assert.strictEqual(res2.ok, true);
  assert.strictEqual(res2.data.createdSheets.length, 0);
  assert.strictEqual(res2.data.existingSheets.length, 4);
});

// 2. PLAYER SERVICE TESTS
console.log('\n--- 2. PlayerService APIs ---');
it('addPlayer adds players sequentially with P001, P002...', () => {
  const p1 = addPlayer('An');
  assert.strictEqual(p1.ok, true);
  assert.strictEqual(p1.data.playerId, 'P001');
  assert.strictEqual(p1.data.name, 'An');
  assert.strictEqual(p1.data.order, 1);
  assert.strictEqual(p1.data.active, true);

  const p2 = addPlayer('Bình');
  assert.strictEqual(p2.ok, true);
  assert.strictEqual(p2.data.playerId, 'P002');
  assert.strictEqual(p2.data.order, 2);

  const p3 = addPlayer('Cường');
  assert.strictEqual(p3.ok, true);
  assert.strictEqual(p3.data.playerId, 'P003');

  const p4 = addPlayer('Dũng');
  assert.strictEqual(p4.ok, true);
  assert.strictEqual(p4.data.playerId, 'P004');
});

it('addPlayer rejects empty names, whitespace-only and duplicates (case-insensitive)', () => {
  const emptyRes = addPlayer('');
  assert.strictEqual(emptyRes.ok, false);
  assert.strictEqual(emptyRes.error.code, 'VALIDATION_ERROR');

  const wsRes = addPlayer('    ');
  assert.strictEqual(wsRes.ok, false);

  const dupRes = addPlayer('  an  '); // case-insensitive match for 'An'
  assert.strictEqual(dupRes.ok, false);
  assert.strictEqual(dupRes.error.code, 'DUPLICATE_PLAYER');
});

it('updatePlayer updates name and prevents duplicate renaming', () => {
  const updateRes = updatePlayer('P001', { name: 'An Nguyễn' });
  assert.strictEqual(updateRes.ok, true);
  assert.strictEqual(updateRes.data.name, 'An Nguyễn');

  const dupUpdateRes = updatePlayer('P002', { name: 'An Nguyễn' });
  assert.strictEqual(dupUpdateRes.ok, false);
  assert.strictEqual(dupUpdateRes.error.code, 'DUPLICATE_PLAYER');
});

it('deactivatePlayer soft-deactivates player without deleting row or data', () => {
  const deactRes = deactivatePlayer('P004');
  assert.strictEqual(deactRes.ok, true);
  assert.strictEqual(deactRes.data.active, false);
  assert.strictEqual(deactRes.data.status, 'NGUNG_CHOI');

  const activePlayers = getPlayers(false);
  assert.strictEqual(activePlayers.data.length, 3);
  assert.ok(!activePlayers.data.some((p) => p.playerId === 'P004'));

  const allPlayers = getPlayers(true);
  assert.strictEqual(allPlayers.data.length, 4);
  assert.ok(allPlayers.data.some((p) => p.playerId === 'P004'));
});

it('reorderPlayers correctly updates display orders in batch', () => {
  const reorderRes = reorderPlayers(['P003', 'P002', 'P001']);
  assert.strictEqual(reorderRes.ok, true);

  const players = reorderRes.data;
  assert.strictEqual(players[0].playerId, 'P003');
  assert.strictEqual(players[0].order, 1);
  assert.strictEqual(players[1].playerId, 'P002');
  assert.strictEqual(players[1].order, 2);
  assert.strictEqual(players[2].playerId, 'P001');
  assert.strictEqual(players[2].order, 3);
});

// 3. GAME SERVICE TESTS
console.log('\n--- 3. GameService & Scoring ---');
it('saveGame calculates deltas, verifies zero-sum, and saves exactly 1 row', () => {
  const initialRoundCount = mockSpreadsheetInstance.getSheetByName('VAN_DAU').getLastRow();

  const saveRes = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'WIN', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 10 }
    ],
    note: 'Ván thử nghiệm 1'
  });

  assert.strictEqual(saveRes.ok, true);
  assert.strictEqual(saveRes.data.game.gameId, 'V000001');
  assert.strictEqual(saveRes.data.game.gameNumber, 1);
  assert.strictEqual(saveRes.data.game.leaderDelta, 5); // -(5 - 10) = +5
  assert.strictEqual(saveRes.data.game.transactionTotal, 15); // |5| + |-10| = 15
  assert.strictEqual(saveRes.data.game.status, 'HOP_LE');

  const finalRoundCount = mockSpreadsheetInstance.getSheetByName('VAN_DAU').getLastRow();
  assert.strictEqual(finalRoundCount, initialRoundCount + 1); // Exactly 1 row added
});

it('saveGame defaults missing opponent result to DRAW and missing bet to defaultBet', () => {
  const saveRes = saveGame({
    leaderId: 'P002',
    defaultBet: 10,
    opponents: [
      { playerId: 'P001' }, // Missing result & bet -> DRAW, bet=10
      { playerId: 'P003', result: 'WIN' } // Missing bet -> WIN, bet=10
    ]
  });

  assert.strictEqual(saveRes.ok, true);
  assert.strictEqual(saveRes.data.game.details[0].result, 'DRAW');
  assert.strictEqual(saveRes.data.game.details[0].bet, 10);
  assert.strictEqual(saveRes.data.game.details[0].delta, 0);

  assert.strictEqual(saveRes.data.game.details[1].result, 'WIN');
  assert.strictEqual(saveRes.data.game.details[1].bet, 10);
  assert.strictEqual(saveRes.data.game.details[1].delta, 10);

  assert.strictEqual(saveRes.data.game.leaderDelta, -10);
});

it('saveGame rejects leader in opponents, duplicate opponents, and inactive players', () => {
  // Leader in opponents
  const res1 = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P001', result: 'WIN' }]
  });
  assert.strictEqual(res1.ok, false);
  assert.strictEqual(res1.error.code, 'INVALID_OPPONENT');

  // Duplicate opponent
  const res2 = saveGame({
    leaderId: 'P001',
    opponents: [
      { playerId: 'P002', result: 'WIN' },
      { playerId: 'P002', result: 'LOSE' }
    ]
  });
  assert.strictEqual(res2.ok, false);
  assert.strictEqual(res2.error.code, 'DUPLICATE_OPPONENT');

  // Inactive player (P004 is NGUNG_CHOI)
  const res3 = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P004', result: 'WIN' }]
  });
  assert.strictEqual(res3.ok, false);
  assert.strictEqual(res3.error.code, 'INACTIVE_PLAYER');
});

it('saveGame rejects invalid bets (negative, float, non-number)', () => {
  const negBet = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: -5 }]
  });
  assert.strictEqual(negBet.ok, false);
  assert.strictEqual(negBet.error.code, 'INVALID_BET');

  const floatBet = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 5.5 }]
  });
  assert.strictEqual(floatBet.ok, false);
  assert.strictEqual(floatBet.error.code, 'INVALID_BET');
});

// 4. GAME LIFECYCLE & HISTORY TESTS
console.log('\n--- 4. Game History, Update, Cancel & Restore ---');
it('getGameHistory returns rounds sorted newest first', () => {
  const hist = getGameHistory();
  assert.strictEqual(hist.ok, true);
  assert.strictEqual(hist.data.length, 2);
  assert.strictEqual(hist.data[0].gameId, 'V000002');
  assert.strictEqual(hist.data[1].gameId, 'V000001');
});

it('getGameById retrieves full parsed details', () => {
  const game = getGameById('V000001');
  assert.strictEqual(game.ok, true);
  assert.strictEqual(game.data.gameId, 'V000001');
  assert.strictEqual(game.data.details.length, 2);
});

it('updateGame updates in-place without changing gameId or gameNumber', () => {
  const updateRes = updateGame('V000001', {
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'LOSE', bet: 5 }, // Changed to LOSE
      { playerId: 'P003', result: 'LOSE', bet: 10 }
    ],
    note: 'Ván 1 sau khi sửa'
  });

  assert.strictEqual(updateRes.ok, true);
  assert.strictEqual(updateRes.data.game.gameId, 'V000001');
  assert.strictEqual(updateRes.data.game.gameNumber, 1);
  assert.strictEqual(updateRes.data.game.leaderDelta, 15); // -(-5 - 10) = +15
});

it('cancelGame performs soft delete (status DA_HUY) and excludes from scoreboard', () => {
  const cancelRes = cancelGame('V000002');
  assert.strictEqual(cancelRes.ok, true);
  assert.strictEqual(cancelRes.data.game.status, 'DA_HUY');

  // getGameHistory by default excludes DA_HUY
  const activeHist = getGameHistory({ includeCancelled: false });
  assert.strictEqual(activeHist.data.length, 1);
  assert.strictEqual(activeHist.data[0].gameId, 'V000001');

  // with includeCancelled: true it returns both
  const allHist = getGameHistory({ includeCancelled: true });
  assert.strictEqual(allHist.data.length, 2);
});

it('restoreGame restores DA_HUY round back to HOP_LE', () => {
  const restoreRes = restoreGame('V000002');
  assert.strictEqual(restoreRes.ok, true);
  assert.strictEqual(restoreRes.data.game.status, 'HOP_LE');

  const activeHist = getGameHistory({ includeCancelled: false });
  assert.strictEqual(activeHist.data.length, 2);
});

// 5. SUMMARY & SCOREBOARD TESTS
console.log('\n--- 5. SummaryService & Scoreboard ---');
it('getScoreboard computes accurate scores, leader counts and zero-sum total across session', () => {
  const scoreboardRes = getScoreboard();
  assert.strictEqual(scoreboardRes.ok, true);
  const sb = scoreboardRes.data;

  // Verify total points across all players equals exactly 0
  const sessionTotalScore = sb.reduce((sum, p) => sum + p.totalScore, 0);
  assert.strictEqual(sessionTotalScore, 0, `Session total score must be 0, got ${sessionTotalScore}`);

  // Inactive player P004 is included with active: false
  const p4 = sb.find((p) => p.playerId === 'P004');
  assert.ok(p4);
  assert.strictEqual(p4.active, false);
  assert.strictEqual(p4.totalScore, 0);
});

it('rebuildSummarySheet writes data successfully to TONG_KET sheet', () => {
  const rebuildRes = rebuildSummarySheet();
  assert.strictEqual(rebuildRes.ok, true);

  const summarySheet = mockSpreadsheetInstance.getSheetByName('TONG_KET');
  assert.ok(summarySheet.getLastRow() > 1);
});

console.log('\n====================================================');
console.log(`PHASE 2 TESTS FINISHED: ${passCount} PASSED | ${failCount} FAILED`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
}
