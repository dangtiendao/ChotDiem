/**
 * @fileoverview phase7.test.js - Phase 7 Deployment, Clean Setup, Test Cleanup, Backup, Export & System Protection Test Suite
 * Run via: node tests/phase7.test.js
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

class MockProtection {
  constructor(sheet) {
    this.sheet = sheet;
    this.description = '';
    this.warningOnly = false;
  }
  setDescription(desc) { this.description = desc; return this; }
  setWarningOnly(val) { this.warningOnly = val; return this; }
}

class MockSheet {
  constructor(name) {
    this.name = name;
    this.data = [];
    this.protections = [];
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

  protect() {
    const p = new MockProtection(this);
    this.protections.push(p);
    return p;
  }

  getProtections() {
    return this.protections;
  }
}

class MockSpreadsheet {
  constructor() {
    this.sheets = new Map();
    this.name = 'Chốt Điểm Deployment Testing Sheet';
    this.id = 'MOCK_SS_PHASE7_DEPLOY';
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
  openById: () => mockSpreadsheetInstance,
  ProtectionType: { SHEET: 'SHEET' }
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

const AdminService = require('../AdminService.gs');
Object.assign(global, AdminService);

const Code = require('../Code.gs');
Object.assign(global, Code);

// Test Harness
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
console.log('RUNNING PHASE 7: DEPLOYMENT & HANDOVER TEST SUITE');
console.log('====================================================\n');

// 1. TASK 7.2: CLEAN SETUP & IDEMPOTENCY
console.log('--- 1. Task 7.2: Clean Spreadsheet Preparation ---');
it('prepareCleanSpreadsheet initializes all 6 sheets with headers, frozen rows & default configs', () => {
  const prep = prepareCleanSpreadsheet({
    sessionName: 'Phiên Bàn Giao Phase 7',
    defaultBet: 5
  });

  assert.strictEqual(prep.ok, true);
  assert.strictEqual(prep.success, true);
  assert.ok(prep.data.createdSheets.includes('CAU_HINH'));
  assert.ok(prep.data.createdSheets.includes('NGUOI_CHOI'));
  assert.ok(prep.data.createdSheets.includes('VAN_DAU'));
  assert.ok(prep.data.createdSheets.includes('TONG_KET'));
  assert.ok(prep.data.createdSheets.includes('LICH_SU_THAY_DOI'));
  assert.ok(prep.data.createdSheets.includes('NHAT_KY'));

  // Run again to verify idempotency
  const prepAgain = prepareCleanSpreadsheet();
  assert.strictEqual(prepAgain.ok, true);
  assert.strictEqual(prepAgain.data.createdSheets.length, 0);
  assert.strictEqual(prepAgain.data.verifiedSheets.length, 6);
});

// 2. TASK 7.1: PRE-DEPLOYMENT HEALTH CHECKS
console.log('\n--- 2. Task 7.1: Pre-Deployment Health Checks ---');
it('runPreDeploymentCheck validates all sheets, headers, config & read capabilities', () => {
  const health = runPreDeploymentCheck();
  assert.strictEqual(health.ok, true);
  assert.strictEqual(health.errors.length, 0);
  assert.ok(health.checks.length >= 6);
  assert.ok(health.checks.some((c) => c.name === 'Spreadsheet Access' && c.ok));
  assert.ok(health.checks.some((c) => c.name.includes('Sheet & Headers: CAU_HINH') && c.ok));
  assert.ok(health.checks.some((c) => c.name.includes('Sheet & Headers: NHAT_KY') && c.ok));
});

// 3. TASK 7.3: CRITICAL LOGGING & SANITIZATION (NHAT_KY)
console.log('\n--- 3. Task 7.3: Critical Event Logging & Sensitive Data Redaction ---');
it('logImportantEvent records events in NHAT_KY and redacts sensitive credentials/tokens', () => {
  const logged = logImportantEvent('WARN', 'TEST_EVENT', {
    source: 'Phase7Test',
    handler: 'testLogger',
    message: 'Testing audit log and redaction',
    details: {
      userToken: 'SECRET_BEARER_TOKEN_123',
      adminPassword: 'SUPER_SECRET_PASSWORD',
      validData: 'Normal scoring data'
    }
  });

  assert.strictEqual(logged, true);
  const logSheet = mockSpreadsheetInstance.getSheetByName('NHAT_KY');
  assert.ok(logSheet.getLastRow() > 1);

  const lastLog = logSheet.getRange(logSheet.getLastRow(), 1, 1, 11).getValues()[0];
  assert.strictEqual(lastLog[1], 'WARN'); // MUC_DO
  assert.strictEqual(lastLog[2], 'TEST_EVENT'); // MA_LOI
  assert.strictEqual(lastLog[3], 'Phase7Test'); // NGUON

  const detailsJson = String(lastLog[8]); // CHI_TIET_RUT_GON
  assert.ok(detailsJson.includes('[REDACTED]'), 'Must redact token and password');
  assert.ok(!detailsJson.includes('SECRET_BEARER_TOKEN_123'), 'Must NOT leak raw token');
  assert.ok(!detailsJson.includes('SUPER_SECRET_PASSWORD'), 'Must NOT leak raw password');
});

// 4. TASK 7.3: BACKUP & TRIGGERS
console.log('\n--- 4. Task 7.3: Backup & Trigger Utilities ---');
it('createSpreadsheetBackup generates snapshot with timestamp and logs to NHAT_KY', () => {
  const backupRes = createSpreadsheetBackup({ customPrefix: 'ChotDiem_Deploy' });
  assert.strictEqual(backupRes.ok, true);
  assert.ok(backupRes.data.backupName.startsWith('ChotDiem_Deploy_'));
  assert.ok(backupRes.data.timestamp);
});

// 5. TASK 7.3: DATA EXPORT (CSV & JSON)
console.log('\n--- 5. Task 7.3: UTF-8 Data Export ---');
it('exportSessionData exports comprehensive session data in UTF-8 CSV and JSON formats', () => {
  // Seed sample round
  addPlayer('Đào');
  addPlayer('Tiến');
  saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'WIN', bet: 5 }]
  });

  // Test CSV export
  const csvRes = exportSessionData('csv');
  assert.strictEqual(csvRes.ok, true);
  assert.strictEqual(csvRes.data.format, 'csv');
  assert.ok(csvRes.data.content.startsWith('\uFEFF'), 'CSV must contain UTF-8 BOM for Excel compatibility');
  assert.ok(csvRes.data.content.includes('BẢNG TỔNG KẾT ĐIỂM SỐ'));
  assert.ok(csvRes.data.content.includes('LỊCH SỬ TỪNG VÁN ĐẤU'));
  assert.ok(csvRes.data.content.includes('Đào'));

  // Test JSON export
  const jsonRes = exportSessionData('json');
  assert.strictEqual(jsonRes.ok, true);
  assert.strictEqual(jsonRes.data.format, 'json');
  assert.strictEqual(jsonRes.data.dataObj.appName, 'Chốt Điểm');
  assert.strictEqual(jsonRes.data.dataObj.scoreboard.length, 2);
});

// 6. TASK 7.2: SAFE TEST DATA CLEANUP (DRY-RUN & EXECUTE)
console.log('\n--- 6. Task 7.2: Safe Test Data Cleanup ---');
it('cleanupTestData accurately identifies test rounds in dryRun and purges cleanly without corrupting real data', () => {
  // Add a test game with testRunId
  saveGame({
    leaderId: 'P001',
    opponents: [{ playerId: 'P002', result: 'LOSE', bet: 5 }],
    requestId: 'TEST_RUN_999_A',
    note: '[TEST] Test Round for cleanup'
  });

  // Dry run
  const dryRes = cleanupTestData({ testRunId: 'TEST_RUN_999' });
  assert.strictEqual(dryRes.ok, true);
  assert.strictEqual(dryRes.data.dryRun, true);
  assert.strictEqual(dryRes.data.deletedRounds, 1);

  // Real execution
  const cleanRes = cleanupTestData({ dryRun: false, testRunId: 'TEST_RUN_999' });
  assert.strictEqual(cleanRes.ok, true);
  assert.strictEqual(cleanRes.data.dryRun, false);
  assert.strictEqual(cleanRes.data.deletedRounds, 1);
});

// 7. TASK 7.3: SYSTEM SHEET PROTECTION
console.log('\n--- 7. Task 7.3: System Sheet Protection ---');
it('protectSystemSheets applies warning protection to system sheets without duplicate locks', () => {
  const protRes = protectSystemSheets();
  assert.strictEqual(protRes.ok, true);
  assert.ok(protRes.data.protectedSheets.includes('CAU_HINH'));
  assert.ok(protRes.data.protectedSheets.includes('VAN_DAU'));
  assert.ok(protRes.data.protectedSheets.includes('TONG_KET'));
  assert.ok(protRes.data.protectedSheets.includes('LICH_SU_THAY_DOI'));
  assert.ok(protRes.data.protectedSheets.includes('NHAT_KY'));
});

// 8. ZERO-SUM INVARIANT FINAL CHECK
console.log('\n--- 8. Session Total Zero-Sum Verification ---');
it('Total Score across all players remains 0', () => {
  const sb = getScoreboard();
  assert.strictEqual(sb.ok, true);
  const total = sb.data.reduce((sum, p) => sum + p.totalScore, 0);
  assert.strictEqual(total, 0);
});

console.log('\n====================================================');
console.log(`PHASE 7 TESTS FINISHED: ${passCount} PASSED | ${failCount} FAILED`);
console.log('====================================================\n');

if (failCount > 0) {
  process.exit(1);
}
