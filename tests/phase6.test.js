/**
 * @fileoverview phase6.test.js - Phase 6 QA, Logic, Integrity, Responsive & Concurrency Comprehensive Test Suite
 * Run via: node tests/phase6.test.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ==========================================================================
// 1. Mock Environment for Google Apps Script & Google Sheets
// ==========================================================================
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

  clearContents() {
    this.data = [];
    return this;
  }

  clear() {
    this.data = [];
    return this;
  }

  setFrozenRows() { return this; }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = new Map();
    this.name = 'Chốt Điểm QA Testing Sheet';
    this.id = 'MOCK_SS_PHASE6_QA';
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

// Global Injectors
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

// Test Framework Harness
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

/**
 * Shared Mathematical Invariant Checker: assertZeroSum
 */
function assertZeroSum(deltas) {
  const sum = deltas.reduce((acc, d) => acc + Number(d || 0), 0);
  assert.strictEqual(
    Math.abs(sum) < 0.000001,
    true,
    `Zero-Sum Invariant Violated! Expected sum = 0, got ${sum}`
  );
}

/**
 * Independent Audit Reconciliation Engine
 */
function auditReconcileSession() {
  const ss = global.SpreadsheetApp.getActiveSpreadsheet();
  const roundSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.VAN_DAU);
  const summarySheet = ss.getSheetByName(CONFIG.SHEET_NAMES.TONG_KET);

  if (!roundSheet || roundSheet.getLastRow() <= 1) return { reconciled: true, totalScore: 0 };

  const rHeaderMap = global.getHeaderMap(roundSheet);
  const rValues = roundSheet.getRange(2, 1, roundSheet.getLastRow() - 1, roundSheet.getLastColumn()).getValues();

  const independentScores = new Map();

  for (const row of rValues) {
    const status = String(row[rHeaderMap.TRANG_THAI - 1] || '').trim().toUpperCase();
    if (status === CONFIG.ROUND_STATUS.DA_HUY) continue; // Exclude cancelled

    const leaderId = String(row[rHeaderMap.MA_NGUOI_CAM_DAU - 1] || '').trim();
    const leaderDelta = Number(row[rHeaderMap.DIEM_CAM_DAU - 1]) || 0;
    const details = global.safeJsonParse(String(row[rHeaderMap.CHI_TIET_JSON - 1] || ''), []);

    // Add leader delta
    independentScores.set(leaderId, (independentScores.get(leaderId) || 0) + leaderDelta);

    // Add opponent deltas
    for (const opp of details) {
      independentScores.set(opp.playerId, (independentScores.get(opp.playerId) || 0) + (Number(opp.delta) || 0));
    }
  }

  // Compare with TONG_KET sheet
  let totalSessionScore = 0;
  if (summarySheet && summarySheet.getLastRow() > 1) {
    const sHeaderMap = global.getHeaderMap(summarySheet);
    const sValues = summarySheet.getRange(2, 1, summarySheet.getLastRow() - 1, summarySheet.getLastColumn()).getValues();

    for (const sRow of sValues) {
      const pId = String(sRow[sHeaderMap.MA_NGUOI_CHOI - 1] || '').trim();
      const sheetScore = Number(sRow[sHeaderMap.TONG_DIEM - 1]) || 0;
      const expectedScore = independentScores.get(pId) || 0;

      assert.strictEqual(
        sheetScore,
        expectedScore,
        `Reconciliation Discrepancy for player '${pId}': Sheet=${sheetScore}, Independent=${expectedScore}`
      );
      totalSessionScore += sheetScore;
    }
  }

  return { reconciled: true, totalScore: totalSessionScore };
}

console.log('====================================================');
console.log('RUNNING PHASE 6: COMPREHENSIVE QA & INTEGRITY SUITE');
console.log('====================================================\n');

// ==========================================================================
// TASK 6.1: KIỂM THỬ LOGIC
// ==========================================================================
console.log('--- TASK 6.1: Logic & Rules Verification ---');

it('6.1.1: Setup and Initialize QA Session Fixture', () => {
  const res = setupApp({ sessionName: 'QA Test Session', defaultBet: 5 });
  assert.strictEqual(res.ok, true);

  // Add players with Unicode & distinct IDs
  addPlayer('Đào (Leader)'); // P001
  addPlayer('Tiến');          // P002
  addPlayer('Bình');          // P003
  addPlayer('Cường');         // P004
  addPlayer('Dũng');          // P005
  addPlayer('Đào');           // Should fail duplicate name
  const dup = addPlayer('Đào (Leader)');
  assert.strictEqual(dup.ok, false);
});

it('6.1.2: 2 Players Game Logic (B wins, B loses, B draws A)', () => {
  // 1. B wins A (Bet 5)
  const g1 = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 5 }]
  });
  assert.strictEqual(g1.ok, true);
  assert.strictEqual(g1.data.game.leaderDelta, -5);
  assert.strictEqual(g1.data.game.details[0].delta, 5);
  assertZeroSum([g1.data.game.leaderDelta, g1.data.game.details[0].delta]);

  // 2. B loses A (Bet 5)
  const g2 = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [{ playerId: 'P002', result: 'LOSE', bet: 5 }]
  });
  assert.strictEqual(g2.ok, true);
  assert.strictEqual(g2.data.game.leaderDelta, 5);
  assert.strictEqual(g2.data.game.details[0].delta, -5);
  assertZeroSum([g2.data.game.leaderDelta, g2.data.game.details[0].delta]);

  // 3. B draws A (Bet 5)
  const g3 = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [{ playerId: 'P002', result: 'DRAW', bet: 5 }]
  });
  assert.strictEqual(g3.ok, true);
  assert.strictEqual(g3.data.game.leaderDelta, 0);
  assert.strictEqual(g3.data.game.details[0].delta, 0);
  assertZeroSum([g3.data.game.leaderDelta, g3.data.game.details[0].delta]);
});

it('6.1.3: Multi-Player Combinations (B win, C lose, D draw, E win)', () => {
  const g4 = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'WIN', bet: 5 },  // +5
      { playerId: 'P003', result: 'LOSE', bet: 5 }, // -5
      { playerId: 'P004', result: 'DRAW', bet: 5 }, // 0
      { playerId: 'P005', result: 'WIN', bet: 5 }   // +5
    ]
  });
  // Total opponents delta = 5 - 5 + 0 + 5 = +5 -> Leader = -5
  assert.strictEqual(g4.ok, true);
  assert.strictEqual(g4.data.game.leaderDelta, -5);
  assertZeroSum([
    g4.data.game.leaderDelta,
    ...g4.data.game.details.map((d) => d.delta)
  ]);
});

it('6.1.4: All Opponents Win (+5 each -> Leader -15)', () => {
  const g5 = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'WIN', bet: 5 },
      { playerId: 'P003', result: 'WIN', bet: 5 },
      { playerId: 'P004', result: 'WIN', bet: 5 }
    ]
  });
  assert.strictEqual(g5.ok, true);
  assert.strictEqual(g5.data.game.leaderDelta, -15);
  assertZeroSum([g5.data.game.leaderDelta, 5, 5, 5]);
});

it('6.1.5: All Opponents Lose (-5 each -> Leader +15)', () => {
  const g6 = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'LOSE', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 5 },
      { playerId: 'P004', result: 'LOSE', bet: 5 }
    ]
  });
  assert.strictEqual(g6.ok, true);
  assert.strictEqual(g6.data.game.leaderDelta, 15);
  assertZeroSum([g6.data.game.leaderDelta, -5, -5, -5]);
});

it('6.1.6: All Opponents Draw (0 each -> Leader 0)', () => {
  const g7 = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'DRAW', bet: 5 },
      { playerId: 'P003', result: 'DRAW', bet: 5 },
      { playerId: 'P004', result: 'DRAW', bet: 5 }
    ]
  });
  assert.strictEqual(g7.ok, true);
  assert.strictEqual(g7.data.game.leaderDelta, 0);
  assertZeroSum([g7.data.game.leaderDelta, 0, 0, 0]);
});

it('6.1.7: Custom Individual Bets & Robust Input Sanitization', () => {
  // B: +5, C: -10, D: 0 (bet 20), E: +7 -> Leader = -(5 - 10 + 0 + 7) = -2
  const g8 = saveGame({
    leaderId: 'P001',
    defaultBet: 5,
    opponents: [
      { playerId: 'P002', result: 'WIN', bet: 5 },
      { playerId: 'P003', result: 'LOSE', bet: 10 },
      { playerId: 'P004', result: 'DRAW', bet: 20 },
      { playerId: 'P005', result: 'WIN', bet: 7 }
    ]
  });
  assert.strictEqual(g8.ok, true);
  assert.strictEqual(g8.data.game.leaderDelta, -2);
  assertZeroSum([g8.data.game.leaderDelta, 5, -10, 0, 7]);

  // Rejection of invalid bets
  assert.strictEqual(saveGame({ leaderId: 'P001', opponents: [{ playerId: 'P002', bet: -10 }] }).ok, false);
  assert.strictEqual(saveGame({ leaderId: 'P001', opponents: [{ playerId: 'P002', bet: 5.5 }] }).ok, false);
  assert.strictEqual(saveGame({ leaderId: 'P001', opponents: [{ playerId: 'P002', bet: 'invalid' }] }).ok, false);
  assert.strictEqual(saveGame({ leaderId: 'P001', opponents: [{ playerId: 'P002', bet: NaN }] }).ok, false);
});

it('6.1.8: Leader Rotation Across Sequential Games', () => {
  // Ván 1: P002 làm Leader
  const r1 = saveGame({ leaderId: 'P002', opponents: [{ playerId: 'P001', result: 'WIN', bet: 5 }] });
  assert.strictEqual(r1.ok, true);
  assert.strictEqual(r1.data.game.leaderId, 'P002');

  // Ván 2: P003 làm Leader
  const r2 = saveGame({ leaderId: 'P003', opponents: [{ playerId: 'P002', result: 'WIN', bet: 5 }] });
  assert.strictEqual(r2.ok, true);
  assert.strictEqual(r2.data.game.leaderId, 'P003');
});

it('6.1.9 & 6.1.10: Player Lifecycle (Add mid-session & Deactivate)', () => {
  // Add P006 mid-session
  const newP = addPlayer('Hải');
  assert.strictEqual(newP.ok, true);
  const p6Id = newP.data.playerId;

  // Deactivate P005 (Dũng)
  const deact = deactivatePlayer('P005');
  assert.strictEqual(deact.ok, true);

  // Attempt to use deactivated P005 in new round must fail
  const failRound = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P005', result: 'WIN', bet: 5 }]
  });
  assert.strictEqual(failRound.ok, false);
  assert.strictEqual(failRound.errorCode, 'INACTIVE_PLAYER');
});

it('6.1.11 & 6.1.12: Edit, Cancel and Restore Lifecycle', () => {
  // Save a game
  const initialGame = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 10 }]
  });
  const gId = initialGame.data.game.gameId;

  // Edit game: Change P002 to LOSE
  const editRes = updateGame(gId, {
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'LOSE', bet: 10 }]
  });
  assert.strictEqual(editRes.ok, true);
  assert.strictEqual(editRes.data.game.status, 'DA_CHINH_SUA');
  assert.strictEqual(editRes.data.game.leaderDelta, 10);

  // Cancel game
  const cancelRes = cancelGame(gId, 'QA Cancel Test');
  assert.strictEqual(cancelRes.ok, true);
  assert.strictEqual(cancelRes.data.game.status, 'DA_HUY');

  // Restore game
  const restoreRes = restoreGame(gId);
  assert.strictEqual(restoreRes.ok, true);
  assert.strictEqual(restoreRes.data.game.status, 'HOP_LE');
});

it('6.1.13: Quick Undo Workflow', () => {
  const gNew = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 5 }]
  });
  const gId = gNew.data.game.gameId;

  // Undo
  const undoRes = undoGame(gId);
  assert.strictEqual(undoRes.ok, true);
  assert.strictEqual(undoRes.data.game.status, 'DA_HUY');
});

// ==========================================================================
// TASK 6.2: KIỂM THỬ TÍNH TOÀN VẸN DỮ LIỆU
// ==========================================================================
console.log('\n--- TASK 6.2: Data Integrity & Zero-Sum Verification ---');

it('6.2.1 & 6.2.2: Comprehensive Audit Reconciliation (Sheet vs Independent Calculation)', () => {
  const reconcile = auditReconcileSession();
  assert.strictEqual(reconcile.reconciled, true);
  assert.strictEqual(reconcile.totalScore, 0, `Total session score must be exactly 0, got ${reconcile.totalScore}`);
});

it('6.2.3: Idempotency & Anti-Duplicate Game Protection', () => {
  const roundSheet = mockSpreadsheetInstance.getSheetByName('VAN_DAU');
  const countBefore = roundSheet.getLastRow();

  const reqId = 'QA-IDEMPOTENT-001';
  const res1 = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 5 }],
    requestId: reqId
  });
  assert.strictEqual(res1.ok, true);
  assert.strictEqual(roundSheet.getLastRow(), countBefore + 1);

  // Send exact duplicate
  const res2 = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 5 }],
    requestId: reqId
  });
  assert.strictEqual(res2.ok, true);
  assert.strictEqual(res2.data.isDuplicate, true);
  assert.strictEqual(roundSheet.getLastRow(), countBefore + 1, 'Must NOT append duplicate row');
});

it('6.2.4: History Snapshot Preservation (Soft Deletes Only)', () => {
  const allHist = getGameHistory({ status: 'ALL' });
  assert.strictEqual(allHist.ok, true);
  assert.ok(allHist.data.length > 0);

  // Verify that cancelled games retain their complete JSON details without data loss
  const cancelledRound = allHist.data.find((g) => g.status === 'DA_HUY');
  if (cancelledRound) {
    assert.ok(cancelledRound.details.length > 0);
    assert.ok(cancelledRound.leaderId);
  }
});

it('6.2.5: Rejection of Anonymous / Malformed Players', () => {
  // Empty leader
  assert.strictEqual(saveGame({ leaderId: '', opponents: [{ playerId: 'P002' }] }).ok, false);
  // Non-existent leader
  assert.strictEqual(saveGame({ leaderId: 'P999', opponents: [{ playerId: 'P002' }] }).ok, false);
  // Leader in opponents
  assert.strictEqual(saveGame({ leaderId: 'P001', opponents: [{ playerId: 'P001' }] }).ok, false);
  // Duplicate opponents
  assert.strictEqual(saveGame({ leaderId: 'P001', opponents: [{ playerId: 'P002' }, { playerId: 'P002' }] }).ok, false);
});

// ==========================================================================
// TASK 6.3: KIỂM THỬ GIAO DIỆN & RESPONSIVE CODE CHECKLIST
// ==========================================================================
console.log('\n--- TASK 6.3: UI, CSS & Responsive Matrix ---');

it('6.3.1 - 6.3.5: Mobile-First Responsive CSS & Viewport Tokens Verification', () => {
  const styles = fs.readFileSync(path.join(__dirname, '../Styles.html'), 'utf-8');
  const index = fs.readFileSync(path.join(__dirname, '../Index.html'), 'utf-8');
  const scripts = fs.readFileSync(path.join(__dirname, '../Scripts.html'), 'utf-8');

  // Touch Target >= 48px
  assert.ok(styles.includes('--touch-target: 48px'));

  // Color accessibility
  assert.ok(styles.includes('--color-win:'));
  assert.ok(styles.includes('--color-lose:'));
  assert.ok(styles.includes('--color-draw:'));

  // Responsive safe-area
  assert.ok(styles.includes('env(safe-area-inset-bottom'));

  // Reduced motion preference
  assert.ok(styles.includes('@media (prefers-reduced-motion: reduce)'));

  // Double-click prevention logic in scripts
  assert.ok(scripts.includes('isSubmitting'));
  assert.ok(scripts.includes('btnSubmit.disabled = true'));
});

// ==========================================================================
// TASK 6.4: KIỂM THỬ ĐỒNG THỜI & OPTIMISTIC CONCURRENCY
// ==========================================================================
console.log('\n--- TASK 6.4: Concurrency, STALE_DATA & Versioning ---');

it('6.4.1 & 6.4.2: STALE_DATA Detection on Multi-Device Save', () => {
  const ss = global.SpreadsheetApp.getActiveSpreadsheet();
  const actualLatest = global.getLatestGameNumber(ss);

  // Attempt to save with outdated expectedLatestGameNumber
  const staleRes = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 5 }],
    expectedLatestGameNumber: actualLatest - 1 // Stale!
  });

  assert.strictEqual(staleRes.ok, false);
  assert.strictEqual(staleRes.errorCode, 'STALE_DATA');
});

it('6.4.3: Optimistic Concurrency Control (VERSION_CONFLICT on Outdated Edit)', () => {
  // Create a game
  const gInit = saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 5 }]
  });
  const gId = gInit.data.game.gameId;

  // Device A edits game -> version increments
  const edit1 = updateGame(gId, {
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'LOSE', bet: 5 }]
  });
  assert.strictEqual(edit1.ok, true);

  // Device B attempts to edit using stale expectedVersion = 1
  const staleEdit = updateGame(gId, {
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'DRAW', bet: 5 }]
  }, 1);

  assert.strictEqual(staleEdit.ok, false);
  assert.strictEqual(staleEdit.errorCode, 'VERSION_CONFLICT');
});

it('6.4.6: Controlled Stress Test (50 Consecutive Transactions)', () => {
  const startTime = Date.now();
  for (let i = 0; i < 50; i++) {
    const oppResult = i % 3 === 0 ? 'WIN' : (i % 3 === 1 ? 'LOSE' : 'DRAW');
    const r = saveGame({
      leaderId: 'P001',
      opponents: [
        { playerId: 'P002', result: oppResult, bet: 5 },
        { playerId: 'P003', result: 'DRAW', bet: 5 }
      ]
    });
    assert.strictEqual(r.ok, true);
  }
  const duration = Date.now() - startTime;
  console.log(`    -> Processed 50 consecutive rounds in ${duration}ms`);

  // Verify Zero-Sum after stress test
  const finalReconcile = auditReconcileSession();
  assert.strictEqual(finalReconcile.reconciled, true);
  assert.strictEqual(finalReconcile.totalScore, 0);
});

console.log('\n====================================================');
console.log(`PHASE 6 QA FINISHED: ${passCount} PASSED | ${failCount} FAILED`);
console.log('====================================================\n');

if (failCount > 0) {
  process.exit(1);
}
