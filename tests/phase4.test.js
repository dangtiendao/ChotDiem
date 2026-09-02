/**
 * @fileoverview Automated Test Suite for Phase 4: Game History, Details, Filters, Edit, Cancel, Restore & Quick Undo
 * Runs offline in Node.js using in-memory mock engine.
 */

const assert = require('assert');
const path = require('path');

const CONFIG = require('../Config.gs');
const Utils = require('../Utils.gs');
const PlayerService = require('../PlayerService.gs');
const GameService = require('../GameService.gs');
const SummaryService = require('../SummaryService.gs');
const Code = require('../Code.gs');

console.log('====================================================');
console.log('RUNNING PHASE 4 GAME HISTORY TEST SUITE');
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

// In-Memory Mock Spreadsheet Engine
class MockRange {
  constructor(sheet, startRow, startCol, numRows, numCols) {
    this.sheet = sheet;
    this.startRow = startRow;
    this.startCol = startCol;
    this.numRows = numRows;
    this.numCols = numCols;
  }
  getValues() {
    const result = [];
    for (let r = 0; r < this.numRows; r++) {
      const row = [];
      const rowIdx = this.startRow - 1 + r;
      for (let c = 0; c < this.numCols; c++) {
        const colIdx = this.startCol - 1 + c;
        row.push(this.sheet.data[rowIdx] ? this.sheet.data[rowIdx][colIdx] : '');
      }
      result.push(row);
    }
    return result;
  }
  setValues(values) {
    for (let r = 0; r < values.length; r++) {
      const rowIdx = this.startRow - 1 + r;
      if (!this.sheet.data[rowIdx]) {
        this.sheet.data[rowIdx] = new Array(this.sheet.data[0] ? this.sheet.data[0].length : 0).fill('');
      }
      for (let c = 0; c < values[r].length; c++) {
        const colIdx = this.startCol - 1 + c;
        this.sheet.data[rowIdx][colIdx] = values[r][c];
      }
    }
  }
  setFontWeight() { return this; }
  setBackground() { return this; }
}

class MockSheet {
  constructor(name, data = []) {
    this.name = name;
    this.data = data;
  }
  getName() { return this.name; }
  getLastRow() { return this.data.length; }
  getLastColumn() { return this.data.length > 0 ? this.data[0].length : 0; }
  getRange(row, col, numRows = 1, numCols = 1) {
    return new MockRange(this, row, col, numRows, numCols);
  }
  appendRow(rowArray) {
    this.data.push([...rowArray]);
  }
  clearContents() {
    if (this.data.length > 1) {
      this.data = [this.data[0]];
    }
  }
  setFrozenRows() {}
}

class MockSpreadsheet {
  constructor() {
    this.sheets = new Map();
  }
  getId() { return 'mock-ss-phase4'; }
  getName() { return 'Mock Spreadsheet Phase 4'; }
  getSheets() { return Array.from(this.sheets.values()); }
  getSheetByName(name) { return this.sheets.get(name) || null; }
  insertSheet(name) {
    const sheet = new MockSheet(name, []);
    this.sheets.set(name, sheet);
    return sheet;
  }
}

let mockSpreadsheet = new MockSpreadsheet();

// Mock getActiveSpreadsheet in Utils
Utils.getActiveSpreadsheet = function() {
  return mockSpreadsheet;
};

// --- Test Suite Execution ---

console.log('--- 1. Setup and Environment Initialization ---');
it('setupApp initializes all 5 sheets including LICH_SU_THAY_DOI audit sheet', () => {
  mockSpreadsheet = new MockSpreadsheet();
  const setupRes = Code.setupApp({ sessionName: 'Buổi Chơi Mẫu' });
  assert.strictEqual(setupRes.ok, true, 'setupApp must succeed');
  assert.ok(mockSpreadsheet.getSheetByName(CONFIG.SHEET_NAMES.LICH_SU_THAY_DOI), 'Must have LICH_SU_THAY_DOI sheet');
  assert.strictEqual(mockSpreadsheet.getSheetByName(CONFIG.SHEET_NAMES.LICH_SU_THAY_DOI).getLastColumn(), 9);
});

console.log('\n--- 2. Data Preparation: Seed Players & Rounds ---');
it('Seeds players and initial games for history testing', () => {
  PlayerService.addPlayer('An Nguyễn');   // P001
  PlayerService.addPlayer('Bình Trần');  // P002
  PlayerService.addPlayer('Cường Lê');   // P003
  PlayerService.addPlayer('Dũng Phạm');  // P004

  // Round 1: P001 (A) vs P002 (LOSE), P003 (LOSE), P004 (LOSE) => Leader +15
  GameService.saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'LOSE', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 5 },
      { playerId: 'P004', result: 'LOSE', bet: 5 }
    ],
    note: 'Ván 1 mở màn'
  });

  // Round 2: P002 (A) vs P001 (WIN), P003 (DRAW), P004 (LOSE) => Leader 0
  GameService.saveGame({
    leaderId: 'P002',
    defaultBet: 10,
    opponents: [
      { playerId: 'P001', result: 'WIN', bet: 10 },
      { playerId: 'P003', result: 'DRAW', bet: 10 },
      { playerId: 'P004', result: 'LOSE', bet: 10 }
    ],
    note: 'Ván 2 cược 10'
  });

  // Round 3: P003 (A) vs P001 (WIN), P002 (WIN), P004 (WIN) => Leader -15
  GameService.saveGame({
    leaderId: 'P003',
    defaultBet: 5,
    opponents: [
      { playerId: 'P001', result: 'WIN', bet: 5 },
      { playerId: 'P002', result: 'WIN', bet: 5 },
      { playerId: 'P004', result: 'WIN', bet: 5 }
    ],
    note: 'Ván 3 A thua trắng'
  });

  const historyRes = GameService.getGameHistory();
  assert.strictEqual(historyRes.ok, true);
  assert.strictEqual(historyRes.data.items.length, 3);
});

console.log('\n--- 3. Task 4.1: Game History List & Calculations ---');
it('getGameHistory returns rounds sorted newest first (Game 3 -> Game 2 -> Game 1)', () => {
  const historyRes = GameService.getGameHistory();
  const items = historyRes.data.items;
  assert.strictEqual(items[0].gameNumber, 3);
  assert.strictEqual(items[1].gameNumber, 2);
  assert.strictEqual(items[2].gameNumber, 1);
});

it('calculateTransactionTotal calculates sum of absolute opponent deltas correctly', () => {
  const historyRes = GameService.getGameHistory();
  const items = historyRes.data.items;
  // Round 1: | -5 | + | -5 | + | -5 | = 15
  assert.strictEqual(items[2].transactionTotal, 15);
  // Round 2: | +10 | + | 0 | + | -10 | = 20
  assert.strictEqual(items[1].transactionTotal, 20);
  // Round 3: | +5 | + | +5 | + | +5 | = 15
  assert.strictEqual(items[0].transactionTotal, 15);
});

console.log('\n--- 4. Task 4.2: Game Detail API ---');
it('getGameDetail returns full breakdown with participants, roles, and deltas', () => {
  const detailRes = GameService.getGameDetail('V000001');
  assert.strictEqual(detailRes.ok, true);
  const detail = detailRes.data;

  assert.strictEqual(detail.gameId, 'V000001');
  assert.strictEqual(detail.leaderId, 'P001');
  assert.strictEqual(detail.leaderDelta, 15);
  assert.strictEqual(detail.participants.length, 4);

  const leaderPart = detail.participants.find((p) => p.playerId === 'P001');
  assert.strictEqual(leaderPart.role, 'LEADER');
  assert.strictEqual(leaderPart.delta, 15);

  const opp2 = detail.participants.find((p) => p.playerId === 'P002');
  assert.strictEqual(opp2.role, 'OPPONENT');
  assert.strictEqual(opp2.result, 'LOSE');
  assert.strictEqual(opp2.delta, -5);
});

console.log('\n--- 5. Task 4.3: History Filters ---');
it('Filters by playerId (matches when player is leader or opponent)', () => {
  // P001 participated in all 3 games
  const p1Res = GameService.getGameHistory({ playerId: 'P001' });
  assert.strictEqual(p1Res.data.items.length, 3);

  // Filter leaderId: P002
  const leaderRes = GameService.getGameHistory({ leaderId: 'P002' });
  assert.strictEqual(leaderRes.data.items.length, 1);
  assert.strictEqual(leaderRes.data.items[0].gameNumber, 2);
});

it('Filters by result for a specific player', () => {
  // P001 won in Game 2 (+10) and Game 3 (+5), leader +15 in Game 1
  const p1Wins = GameService.getGameHistory({ playerId: 'P001', result: 'WIN' });
  assert.strictEqual(p1Wins.data.items.length, 3); // Game 1 (Leader +15 win), Game 2, Game 3

  const p2Wins = GameService.getGameHistory({ playerId: 'P002', result: 'WIN' });
  assert.strictEqual(p2Wins.data.items.length, 1); // Only Game 3
});

it('Filters by round range (fromGameNumber & toGameNumber)', () => {
  const rangeRes = GameService.getGameHistory({ fromGameNumber: 2, toGameNumber: 3 });
  assert.strictEqual(rangeRes.data.items.length, 2);
  assert.strictEqual(rangeRes.data.items[0].gameNumber, 3);
  assert.strictEqual(rangeRes.data.items[1].gameNumber, 2);

  // Reject invalid range from > to
  const invalidRange = GameService.getGameHistory({ fromGameNumber: 5, toGameNumber: 2 });
  assert.strictEqual(invalidRange.ok, false);
  assert.strictEqual(invalidRange.error.code, CONFIG.ERROR_CODES.VALIDATION_ERROR);
});

console.log('\n--- 6. Task 4.4: Edit, Cancel, Restore & Audit Log ---');
it('updateGame edits round in-place, changes status to DA_CHINH_SUA and writes audit snapshot', () => {
  // Update Game 1: change P002 result to WIN (+5) => Leader delta becomes +5 (instead of +15)
  const updateRes = GameService.updateGame('V000001', {
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'WIN', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 5 },
      { playerId: 'P004', result: 'LOSE', bet: 5 }
    ],
    note: 'Sửa ván 1: P002 thực ra thắng'
  });

  assert.strictEqual(updateRes.ok, true);
  assert.strictEqual(updateRes.data.game.status, CONFIG.ROUND_STATUS.DA_CHINH_SUA);
  assert.strictEqual(updateRes.data.game.leaderDelta, 5);

  // Check audit sheet entry
  const auditSheet = mockSpreadsheet.getSheetByName(CONFIG.SHEET_NAMES.LICH_SU_THAY_DOI);
  assert.ok(auditSheet.getLastRow() >= 2, 'Must have at least 1 audit entry');
});

it('cancelGame soft-deletes round (status DA_HUY) and excludes from Scoreboard', () => {
  // Cancel Game 3
  const cancelRes = GameService.cancelGame('V000003', 'Hủy do nhập nhầm bàn');
  assert.strictEqual(cancelRes.ok, true);
  assert.strictEqual(cancelRes.data.game.status, CONFIG.ROUND_STATUS.DA_HUY);

  // Game 3 should not be in Scoreboard
  const scoreRes = SummaryService.getScoreboard();
  const p3Stats = scoreRes.data.find((p) => p.playerId === 'P003');
  // P003 was leader in Game 3 (-15) which is now cancelled, lost in Game 1 (-5) and drew in Game 2 (0)
  assert.strictEqual(p3Stats.totalScore, -5);
});

it('restoreGame restores DA_HUY round back to valid status and updates Scoreboard', () => {
  const restoreRes = GameService.restoreGame('V000003');
  assert.strictEqual(restoreRes.ok, true);
  assert.strictEqual(restoreRes.data.game.status, CONFIG.ROUND_STATUS.HOP_LE);

  const scoreRes = SummaryService.getScoreboard();
  const p3Stats = scoreRes.data.find((p) => p.playerId === 'P003');
  // P003: Game 1 (-5) + Game 2 (0) + Game 3 (-15) = -20
  assert.strictEqual(p3Stats.totalScore, -20);
});

console.log('\n--- 7. Task 4.5: Quick Undo ---');
it('undoGame marks round as DA_HUY with QUICK_UNDO reason and recalculates score', () => {
  // Create Round 4
  const g4Res = GameService.saveGame({
    leaderId: 'P004',
    defaultBet: 5,
    opponents: [
      { playerId: 'P001', result: 'LOSE', bet: 5 },
      { playerId: 'P002', result: 'LOSE', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 5 }
    ]
  });
  const g4Id = g4Res.data.game.gameId;

  // Immediately perform quick undo
  const undoRes = GameService.undoGame(g4Id);
  assert.strictEqual(undoRes.ok, true);
  assert.strictEqual(undoRes.data.game.status, CONFIG.ROUND_STATUS.DA_HUY);

  // Check audit reason
  const auditSheet = mockSpreadsheet.getSheetByName(CONFIG.SHEET_NAMES.LICH_SU_THAY_DOI);
  const auditValues = auditSheet.getRange(2, 1, auditSheet.getLastRow() - 1, 9).getValues();
  const lastAudit = auditValues[auditValues.length - 1];
  assert.strictEqual(lastAudit[1], g4Id); // gameId
  assert.strictEqual(lastAudit[7], 'QUICK_UNDO'); // reason
});

console.log('\n--- 8. Session Total Zero-Sum Verification ---');
it('Total score across all players remains exactly 0 after all edits, cancels, and restores', () => {
  const scoreRes = SummaryService.getScoreboard();
  assert.strictEqual(scoreRes.ok, true);
  const sumTotal = scoreRes.data.reduce((sum, p) => sum + p.totalScore, 0);
  assert.strictEqual(sumTotal, 0, 'Total score across entire session must sum to 0');
});

console.log('\n====================================================');
console.log(`PHASE 4 TESTS FINISHED: ${passCount} PASSED | ${failCount} FAILED`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
}
