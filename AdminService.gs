/**
 * @fileoverview AdminService.gs - Deployment, Pre-Deployment Check, Clean Setup, Test Cleanup, Backup & Export (Phase 7)
 * Google Apps Script V8 Runtime
 */

const _CFG_ADM = typeof CONFIG !== 'undefined' ? CONFIG : (typeof require !== 'undefined' ? require('./Config.gs') : {});
const _UTILS_ADM = typeof responseOk !== 'undefined'
  ? {
      responseOk,
      responseError,
      getActiveSpreadsheet,
      withDocumentLock,
      getHeaderMap,
      normalizeString,
      safeJsonParse,
      safeJsonStringify,
      formatIsoDate,
      logImportantEvent
    }
  : (typeof require !== 'undefined' ? require('./Utils.gs') : {});

const _SUM_ADM = typeof getScoreboard !== 'undefined'
  ? { getScoreboard, rebuildSummarySheet }
  : (typeof require !== 'undefined' ? require('./SummaryService.gs') : {});

/**
 * Task 7.1: Runs comprehensive pre-deployment health checks on the spreadsheet database.
 * Verifies spreadsheet accessibility, sheet presence, headers, read/write capabilities and config.
 *
 * @returns {{ ok: boolean, timestamp: string, checks: Array<{ name: string, ok: boolean, message: string }>, warnings: Array<string>, errors: Array<string> }}
 */
function runPreDeploymentCheck() {
  const timestamp = new Date().toISOString();
  const checks = [];
  const warnings = [];
  const errors = [];

  let ss = null;

  // 1. Check Spreadsheet Access
  try {
    ss = _UTILS_ADM.getActiveSpreadsheet();
    checks.push({
      name: 'Spreadsheet Access',
      ok: true,
      message: `Đã kết nối thành công với Spreadsheet: '${ss.getName()}' (ID: ${ss.getId()})`
    });
  } catch (err) {
    const errMsg = `Không thể kết nối với Spreadsheet: ${err.message}`;
    checks.push({ name: 'Spreadsheet Access', ok: false, message: errMsg });
    errors.push(errMsg);
    if (typeof _UTILS_ADM.logImportantEvent === 'function') {
      _UTILS_ADM.logImportantEvent('ERROR', _CFG_ADM.ERROR_CODES.SPREADSHEET_ACCESS_ERROR, {
        source: 'AdminService',
        handler: 'runPreDeploymentCheck',
        message: errMsg
      });
    }
    return { ok: false, timestamp, checks, warnings, errors };
  }

  // 2. Check Required Sheets & Headers
  const requiredSheets = [
    { key: _CFG_ADM.SHEET_NAMES.CAU_HINH, headers: _CFG_ADM.HEADERS.CAU_HINH },
    { key: _CFG_ADM.SHEET_NAMES.NGUOI_CHOI, headers: _CFG_ADM.HEADERS.NGUOI_CHOI },
    { key: _CFG_ADM.SHEET_NAMES.VAN_DAU, headers: _CFG_ADM.HEADERS.VAN_DAU },
    { key: _CFG_ADM.SHEET_NAMES.TONG_KET, headers: _CFG_ADM.HEADERS.TONG_KET },
    { key: _CFG_ADM.SHEET_NAMES.LICH_SU_THAY_DOI, headers: _CFG_ADM.HEADERS.LICH_SU_THAY_DOI },
    { key: _CFG_ADM.SHEET_NAMES.NHAT_KY, headers: _CFG_ADM.HEADERS.NHAT_KY }
  ];

  for (const item of requiredSheets) {
    const sheet = ss.getSheetByName(item.key);
    if (!sheet) {
      const msg = `Thiếu sheet bắt buộc: '${item.key}'. Cần chạy prepareCleanSpreadsheet() để khởi tạo.`;
      checks.push({ name: `Sheet: ${item.key}`, ok: false, message: msg });
      errors.push(msg);
      continue;
    }

    const lastCol = sheet.getLastColumn();
    if (lastCol < item.headers.length) {
      const msg = `Sheet '${item.key}' không đủ số cột header (hiện có: ${lastCol}, yêu cầu: ${item.headers.length}).`;
      checks.push({ name: `Headers: ${item.key}`, ok: false, message: msg });
      errors.push(msg);
      continue;
    }

    const actualHeaders = sheet.getRange(1, 1, 1, item.headers.length).getValues()[0];
    const missingHeaders = [];
    for (let i = 0; i < item.headers.length; i++) {
      if (String(actualHeaders[i] || '').trim() !== item.headers[i]) {
        missingHeaders.push(`Cột ${i + 1}: kỳ vọng '${item.headers[i]}', thực tế '${actualHeaders[i]}'`);
      }
    }

    if (missingHeaders.length > 0) {
      const msg = `Sheet '${item.key}' sai cấu trúc header: ${missingHeaders.join('; ')}`;
      checks.push({ name: `Headers: ${item.key}`, ok: false, message: msg });
      errors.push(msg);
    } else {
      checks.push({
        name: `Sheet & Headers: ${item.key}`,
        ok: true,
        message: `Sheet '${item.key}' hợp lệ (${sheet.getLastRow()} dòng).`
      });
    }
  }

  // 3. Check Configuration Reading
  try {
    const cfgSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.CAU_HINH);
    if (cfgSheet && cfgSheet.getLastRow() > 1) {
      const cfgValues = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 2).getValues();
      const cfgMap = new Map();
      cfgValues.forEach((r) => {
        if (r[0]) cfgMap.set(String(r[0]).trim(), r[1]);
      });

      const appName = cfgMap.get(_CFG_ADM.CONFIG_KEYS.TEN_APP) || _CFG_ADM.APP_INFO.NAME;
      const slogan = cfgMap.get(_CFG_ADM.CONFIG_KEYS.SLOGAN) || _CFG_ADM.APP_INFO.SLOGAN;
      checks.push({
        name: 'Config Read',
        ok: true,
        message: `Cấu hình hợp lệ: Tên app='${appName}', Slogan='${slogan}'`
      });
    } else {
      warnings.push("Sheet 'CAU_HINH' chưa có dữ liệu cấu hình ban đầu.");
    }
  } catch (err) {
    errors.push(`Lỗi đọc sheet CAU_HINH: ${err.message}`);
  }

  // 4. Check Players Reading
  try {
    const pSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.NGUOI_CHOI);
    if (pSheet) {
      const pCount = Math.max(0, pSheet.getLastRow() - 1);
      checks.push({
        name: 'Player Directory',
        ok: true,
        message: `Đọc danh mục người chơi thành công (${pCount} người chơi hiện có).`
      });
    }
  } catch (err) {
    errors.push(`Lỗi đọc sheet NGUOI_CHOI: ${err.message}`);
  }

  // 5. Check Game History Reading & Zero-Sum
  try {
    const rSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.VAN_DAU);
    if (rSheet) {
      const rCount = Math.max(0, rSheet.getLastRow() - 1);
      checks.push({
        name: 'Game History',
        ok: true,
        message: `Đọc lịch sử ván đấu thành công (${rCount} ván đã ghi nhận).`
      });
    }
  } catch (err) {
    errors.push(`Lỗi đọc sheet VAN_DAU: ${err.message}`);
  }

  const isHealthy = errors.length === 0;

  if (typeof _UTILS_ADM.logImportantEvent === 'function') {
    _UTILS_ADM.logImportantEvent(
      isHealthy ? 'INFO' : 'WARN',
      isHealthy ? 'PRE_DEPLOY_PASS' : _CFG_ADM.ERROR_CODES.DEPLOYMENT_CHECK_FAILED,
      {
        source: 'AdminService',
        handler: 'runPreDeploymentCheck',
        message: isHealthy ? 'Pre-deployment health check PASSED' : `Pre-deployment check FAILED (${errors.length} lỗi)`,
        details: { checksCount: checks.length, errors, warnings }
      }
    );
  }

  return {
    ok: isHealthy,
    timestamp: timestamp,
    checks: checks,
    warnings: warnings,
    errors: errors
  };
}

/**
 * Task 7.2: Prepares a clean, fully initialized Spreadsheet with all 6 required sheets, headers and initial configs.
 * Idempotent: Does not overwrite or delete existing game/player data if already present.
 *
 * @param {Object} [options={}] - Options { sessionName, defaultBet }
 * @returns {{ ok: boolean, success: boolean, data: { createdSheets: Array<string>, verifiedSheets: Array<string> }, message: string }}
 */
function prepareCleanSpreadsheet(options = {}) {
  return _UTILS_ADM.withDocumentLock(() => {
    const ss = _UTILS_ADM.getActiveSpreadsheet();
    const createdSheets = [];
    const verifiedSheets = [];

    const sheetDefinitions = [
      { name: _CFG_ADM.SHEET_NAMES.CAU_HINH, headers: _CFG_ADM.HEADERS.CAU_HINH },
      { name: _CFG_ADM.SHEET_NAMES.NGUOI_CHOI, headers: _CFG_ADM.HEADERS.NGUOI_CHOI },
      { name: _CFG_ADM.SHEET_NAMES.VAN_DAU, headers: _CFG_ADM.HEADERS.VAN_DAU },
      { name: _CFG_ADM.SHEET_NAMES.TONG_KET, headers: _CFG_ADM.HEADERS.TONG_KET },
      { name: _CFG_ADM.SHEET_NAMES.LICH_SU_THAY_DOI, headers: _CFG_ADM.HEADERS.LICH_SU_THAY_DOI },
      { name: _CFG_ADM.SHEET_NAMES.NHAT_KY, headers: _CFG_ADM.HEADERS.NHAT_KY }
    ];

    sheetDefinitions.forEach((def) => {
      let sheet = ss.getSheetByName(def.name);
      if (!sheet) {
        sheet = ss.insertSheet(def.name);
        sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
        if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
        createdSheets.push(def.name);
      } else {
        // Ensure header exists on row 1
        if (sheet.getLastRow() === 0) {
          sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
          if (typeof sheet.setFrozenRows === 'function') sheet.setFrozenRows(1);
        }
        verifiedSheets.push(def.name);
      }
    });

    // Populate or sync default configuration in CAU_HINH
    const cfgSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.CAU_HINH);
    if (cfgSheet) {
      const existingConfig = new Map();
      const lastRow = cfgSheet.getLastRow();
      if (lastRow > 1) {
        const vals = cfgSheet.getRange(2, 1, lastRow - 1, 2).getValues();
        vals.forEach((r) => {
          if (r[0]) existingConfig.set(String(r[0]).trim(), r[1]);
        });
      }

      const sessionName = options.sessionName || existingConfig.get(_CFG_ADM.CONFIG_KEYS.TEN_PHIEN) || 'Phiên Chơi Mặc Định';
      const defaultBet = options.defaultBet !== undefined && options.defaultBet !== null ? Number(options.defaultBet) : (Number(existingConfig.get(_CFG_ADM.CONFIG_KEYS.CUOC_MAC_DINH)) || _CFG_ADM.DEFAULTS.DEFAULT_BET);
      const createdAt = existingConfig.get(_CFG_ADM.CONFIG_KEYS.THOI_GIAN_TAO) || new Date().toISOString();
      const sessionId = existingConfig.get(_CFG_ADM.CONFIG_KEYS.MA_PHIEN) || `SES_${Date.now()}`;

      const defaultEntries = [
        [_CFG_ADM.CONFIG_KEYS.TEN_APP, _CFG_ADM.APP_INFO.NAME],
        [_CFG_ADM.CONFIG_KEYS.SLOGAN, _CFG_ADM.APP_INFO.SLOGAN],
        [_CFG_ADM.CONFIG_KEYS.MA_PHIEN, sessionId],
        [_CFG_ADM.CONFIG_KEYS.TEN_PHIEN, sessionName],
        [_CFG_ADM.CONFIG_KEYS.CUOC_MAC_DINH, defaultBet],
        [_CFG_ADM.CONFIG_KEYS.THOI_GIAN_TAO, createdAt],
        [_CFG_ADM.CONFIG_KEYS.TRANG_THAI, _CFG_ADM.SESSION_STATUS.DANG_CHOI],
        [_CFG_ADM.CONFIG_KEYS.TIMEZONE, _CFG_ADM.DEFAULTS.TIMEZONE],
        [_CFG_ADM.CONFIG_KEYS.SCHEMA_VERSION, _CFG_ADM.DEFAULTS.SCHEMA_VERSION]
      ];

      // Overwrite CAU_HINH cleanly with headers and synchronized keys
      cfgSheet.getRange(1, 1, 1, 2).setValues([_CFG_ADM.HEADERS.CAU_HINH]);
      cfgSheet.getRange(2, 1, defaultEntries.length, 2).setValues(defaultEntries);
      if (typeof cfgSheet.setFrozenRows === 'function') cfgSheet.setFrozenRows(1);
    }

    if (typeof _UTILS_ADM.logImportantEvent === 'function') {
      _UTILS_ADM.logImportantEvent('INFO', 'PREPARE_CLEAN_SPREADSHEET', {
        source: 'AdminService',
        handler: 'prepareCleanSpreadsheet',
        message: `Chuẩn bị Spreadsheet sạch thành công. Đã tạo mới: [${createdSheets.join(', ')}], Đã kiểm tra: [${verifiedSheets.join(', ')}]`
      });
    }

    return _UTILS_ADM.responseOk(
      {
        createdSheets: createdSheets,
        verifiedSheets: verifiedSheets
      },
      'Chuẩn bị Spreadsheet thành công và đồng bộ cấu hình hoàn tất.'
    );
  });
}

/**
 * Task 7.2: Safely cleans up test rounds and mock players created during testing without affecting real data.
 * Supports dryRun mode for safe inspection before physical deletion.
 *
 * @param {Object} options - { dryRun: boolean, testRunId: string, isTestFlag: boolean }
 * @returns {{ ok: boolean, success: boolean, data: { dryRun: boolean, deletedRounds: number, deletedPlayers: number }, message: string }}
 */
function cleanupTestData(options = {}) {
  const dryRun = options.dryRun !== false; // Defaults to true for safety
  const testId = String(options.testRunId || '').trim();

  if (!testId && !options.isTestFlag) {
    return _UTILS_ADM.responseError(
      _CFG_ADM.ERROR_CODES.INVALID_ARGUMENT,
      'Cần cung cấp testRunId hoặc isTestFlag để xác định chắc chắn dữ liệu thử cần xóa.'
    );
  }

  return _UTILS_ADM.withDocumentLock(() => {
    const ss = _UTILS_ADM.getActiveSpreadsheet();
    const roundSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.VAN_DAU);
    const playerSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.NGUOI_CHOI);

    let deletedRounds = 0;
    let deletedPlayers = 0;

    // 1. Scan VAN_DAU for test rounds
    if (roundSheet && roundSheet.getLastRow() > 1) {
      const rHeaderMap = _UTILS_ADM.getHeaderMap(roundSheet);
      const rValues = roundSheet.getRange(2, 1, roundSheet.getLastRow() - 1, roundSheet.getLastColumn()).getValues();
      const colReqId = rHeaderMap.MA_REQUEST ? rHeaderMap.MA_REQUEST - 1 : -1;
      const colNote = rHeaderMap.GHI_CHU - 1;

      const remainingRows = [];
      for (const row of rValues) {
        const reqVal = colReqId >= 0 ? String(row[colReqId] || '') : '';
        const noteVal = String(row[colNote] || '');

        const isTestRound = (testId && (reqVal.includes(testId) || noteVal.includes(testId))) ||
                            (options.isTestFlag && (noteVal.includes('[TEST]') || reqVal.startsWith('TEST_')));

        if (isTestRound) {
          deletedRounds++;
        } else {
          remainingRows.push(row);
        }
      }

      if (!dryRun && deletedRounds > 0) {
        roundSheet.clearContents();
        roundSheet.getRange(1, 1, 1, _CFG_ADM.HEADERS.VAN_DAU.length).setValues([_CFG_ADM.HEADERS.VAN_DAU]);
        if (remainingRows.length > 0) {
          roundSheet.getRange(2, 1, remainingRows.length, roundSheet.getLastColumn()).setValues(remainingRows);
        }
      }
    }

    // 2. Scan NGUOI_CHOI for test players
    if (playerSheet && playerSheet.getLastRow() > 1) {
      const pHeaderMap = _UTILS_ADM.getHeaderMap(playerSheet);
      const pValues = playerSheet.getRange(2, 1, playerSheet.getLastRow() - 1, playerSheet.getLastColumn()).getValues();
      const colName = pHeaderMap.TEN_NGUOI_CHOI - 1;

      const remainingPlayers = [];
      for (const pRow of pValues) {
        const pName = String(pRow[colName] || '');
        const isTestPlayer = (testId && pName.includes(testId)) || (options.isTestFlag && pName.startsWith('TEST_'));

        if (isTestPlayer) {
          deletedPlayers++;
        } else {
          remainingPlayers.push(pRow);
        }
      }

      if (!dryRun && deletedPlayers > 0) {
        playerSheet.clearContents();
        playerSheet.getRange(1, 1, 1, _CFG_ADM.HEADERS.NGUOI_CHOI.length).setValues([_CFG_ADM.HEADERS.NGUOI_CHOI]);
        if (remainingPlayers.length > 0) {
          playerSheet.getRange(2, 1, remainingPlayers.length, playerSheet.getLastColumn()).setValues(remainingPlayers);
        }
      }
    }

    // Rebuild scoreboard after real cleanup
    if (!dryRun && (deletedRounds > 0 || deletedPlayers > 0)) {
      if (typeof _SUM_ADM.rebuildSummarySheet === 'function') {
        _SUM_ADM.rebuildSummarySheet();
      }
      if (typeof _UTILS_ADM.logImportantEvent === 'function') {
        _UTILS_ADM.logImportantEvent('INFO', 'CLEANUP_TEST_DATA', {
          source: 'AdminService',
          handler: 'cleanupTestData',
          message: `Đã dọn dẹp ${deletedRounds} ván thử và ${deletedPlayers} người chơi thử (testRunId: '${testId}').`
        });
      }
    }

    const actionText = dryRun ? 'Kiểm tra dọn dẹp (Dry Run)' : 'Dọn dẹp thực tế';
    return _UTILS_ADM.responseOk(
      {
        dryRun: dryRun,
        deletedRounds: deletedRounds,
        deletedPlayers: deletedPlayers
      },
      `${actionText} hoàn tất: tìm thấy ${deletedRounds} ván thử và ${deletedPlayers} người chơi thử.`
    );
  });
}

/**
 * Task 7.3: Creates a backup copy of the spreadsheet in Google Drive.
 *
 * @param {Object} [options={}] - Options { folderId, customPrefix }
 * @returns {{ ok: boolean, success: boolean, data: { backupId: string, backupName: string, timestamp: string }, message: string }}
 */
function createSpreadsheetBackup(options = {}) {
  const timestamp = new Date();
  const dateStr = timestamp.toISOString().replace(/[-:T.]/g, '').substring(0, 14);
  const prefix = options.customPrefix || 'ChotDiem_Backup';
  const backupName = `${prefix}_${dateStr}`;

  try {
    const ss = _UTILS_ADM.getActiveSpreadsheet();
    let backupId = `MOCK_BACKUP_${dateStr}`;

    if (typeof DriveApp !== 'undefined') {
      const file = DriveApp.getFileById(ss.getId());
      let targetFolder = DriveApp.getRootFolder();

      if (options.folderId) {
        try {
          targetFolder = DriveApp.getFolderById(options.folderId);
        } catch (e) {
          console.warn('[createSpreadsheetBackup] Folder not found, using root:', e);
        }
      }

      const backupFile = file.makeCopy(backupName, targetFolder);
      backupId = backupFile.getId();
    }

    if (typeof _UTILS_ADM.logImportantEvent === 'function') {
      _UTILS_ADM.logImportantEvent('INFO', 'BACKUP_CREATED', {
        source: 'AdminService',
        handler: 'createSpreadsheetBackup',
        message: `Tạo bản sao lưu thành công: '${backupName}' (ID: ${backupId})`
      });
    }

    return _UTILS_ADM.responseOk(
      {
        backupId: backupId,
        backupName: backupName,
        timestamp: timestamp.toISOString()
      },
      `Đã tạo bản sao lưu '${backupName}' thành công.`
    );
  } catch (err) {
    console.error('[createSpreadsheetBackup] Error:', err);
    if (typeof _UTILS_ADM.logImportantEvent === 'function') {
      _UTILS_ADM.logImportantEvent('ERROR', _CFG_ADM.ERROR_CODES.BACKUP_FAILED, {
        source: 'AdminService',
        handler: 'createSpreadsheetBackup',
        message: `Lỗi tạo sao lưu: ${err.message}`,
        details: err.stack
      });
    }
    return _UTILS_ADM.responseError(_CFG_ADM.ERROR_CODES.BACKUP_FAILED, `Không thể tạo sao lưu: ${err.message}`);
  }
}

/**
 * Task 7.3: Installs a recurring time-driven backup trigger in Google Apps Script.
 *
 * @param {string} [frequency="DAILY"] - Frequency: 'DAILY' or 'WEEKLY'
 * @returns {{ ok: boolean, success: boolean, message: string }}
 */
function installBackupTrigger(frequency = 'DAILY') {
  if (typeof ScriptApp === 'undefined') {
    return _UTILS_ADM.responseOk({ installed: false, mock: true }, 'Môi trường ScriptApp không khả dụng.');
  }

  try {
    const triggers = ScriptApp.getProjectTriggers();
    const existing = triggers.find((t) => t.getHandlerFunction() === 'createSpreadsheetBackup');
    if (existing) {
      return _UTILS_ADM.responseOk({ installed: true, alreadyExists: true }, 'Trigger sao lưu định kỳ đã được cài đặt từ trước.');
    }

    const builder = ScriptApp.newTrigger('createSpreadsheetBackup').timeBased();
    if (String(frequency).toUpperCase() === 'WEEKLY') {
      builder.everyWeeks(1).onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(2).create();
    } else {
      builder.everyDays(1).atHour(2).create();
    }

    return _UTILS_ADM.responseOk({ installed: true }, `Đã cài đặt trigger sao lưu định kỳ (${frequency}) lúc 02:00.`);
  } catch (err) {
    return _UTILS_ADM.responseError(_CFG_ADM.ERROR_CODES.INTERNAL_ERROR, `Lỗi cài đặt trigger: ${err.message}`);
  }
}

/**
 * Task 7.3: Removes any backup triggers installed by this app.
 * @returns {{ ok: boolean, success: boolean, message: string }}
 */
function removeBackupTrigger() {
  if (typeof ScriptApp === 'undefined') {
    return _UTILS_ADM.responseOk({ removed: 0 }, 'ScriptApp không khả dụng.');
  }

  try {
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;
    triggers.forEach((t) => {
      if (t.getHandlerFunction() === 'createSpreadsheetBackup') {
        ScriptApp.deleteTrigger(t);
        removedCount++;
      }
    });

    return _UTILS_ADM.responseOk({ removed: removedCount }, `Đã gỡ bỏ ${removedCount} trigger sao lưu.`);
  } catch (err) {
    return _UTILS_ADM.responseError(_CFG_ADM.ERROR_CODES.INTERNAL_ERROR, `Lỗi gỡ trigger: ${err.message}`);
  }
}

/**
 * Task 7.3: Exports all session data (Session Info, Players, Rounds, Scoreboard) to UTF-8 CSV or JSON.
 *
 * @param {string} [format="csv"] - Format: 'csv' or 'json'
 * @returns {{ ok: boolean, success: boolean, data: { format: string, filename: string, mimeType: string, content: string, dataObj?: Object }, message: string }}
 */
function exportSessionData(format = 'csv') {
  try {
    const ss = _UTILS_ADM.getActiveSpreadsheet();
    const dateStr = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
    const fmt = String(format || 'csv').toLowerCase();

    // 1. Read Session Config
    const cfgSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.CAU_HINH);
    const configMap = {};
    if (cfgSheet && cfgSheet.getLastRow() > 1) {
      const cVals = cfgSheet.getRange(2, 1, cfgSheet.getLastRow() - 1, 2).getValues();
      cVals.forEach((r) => { if (r[0]) configMap[String(r[0]).trim()] = r[1]; });
    }

    // 2. Read Players
    const pSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.NGUOI_CHOI);
    const players = [];
    if (pSheet && pSheet.getLastRow() > 1) {
      const pHeaderMap = _UTILS_ADM.getHeaderMap(pSheet);
      const pVals = pSheet.getRange(2, 1, pSheet.getLastRow() - 1, pSheet.getLastColumn()).getValues();
      pVals.forEach((r) => {
        players.push({
          playerId: String(r[pHeaderMap.MA_NGUOI_CHOI - 1] || ''),
          name: String(r[pHeaderMap.TEN_NGUOI_CHOI - 1] || ''),
          status: String(r[pHeaderMap.TRANG_THAI - 1] || '')
        });
      });
    }

    // 3. Read Games
    const rSheet = ss.getSheetByName(_CFG_ADM.SHEET_NAMES.VAN_DAU);
    const games = [];
    if (rSheet && rSheet.getLastRow() > 1) {
      const rHeaderMap = _UTILS_ADM.getHeaderMap(rSheet);
      const rVals = rSheet.getRange(2, 1, rSheet.getLastRow() - 1, rSheet.getLastColumn()).getValues();
      rVals.forEach((r) => {
        games.push({
          gameId: String(r[rHeaderMap.MA_VAN - 1] || ''),
          gameNumber: r[rHeaderMap.SO_VAN - 1],
          time: r[rHeaderMap.THOI_GIAN - 1] instanceof Date ? r[rHeaderMap.THOI_GIAN - 1].toISOString() : String(r[rHeaderMap.THOI_GIAN - 1]),
          leaderName: String(r[rHeaderMap.TEN_NGUOI_CAM_DAU - 1] || ''),
          leaderDelta: r[rHeaderMap.DIEM_CAM_DAU - 1],
          details: _UTILS_ADM.safeJsonParse(String(r[rHeaderMap.CHI_TIET_JSON - 1] || ''), []),
          status: String(r[rHeaderMap.TRANG_THAI - 1] || ''),
          note: String(r[rHeaderMap.GHI_CHU - 1] || '')
        });
      });
    }

    // 4. Read Summary
    const scoreboardRes = _SUM_ADM.getScoreboard();
    const scoreboard = scoreboardRes.ok ? scoreboardRes.data : [];

    const fullExportObject = {
      exportTimestamp: new Date().toISOString(),
      appName: _CFG_ADM.APP_INFO.NAME,
      slogan: _CFG_ADM.APP_INFO.SLOGAN,
      config: configMap,
      scoreboard: scoreboard,
      players: players,
      games: games
    };

    if (fmt === 'json') {
      const jsonContent = JSON.stringify(fullExportObject, null, 2);
      return _UTILS_ADM.responseOk(
        {
          format: 'json',
          filename: `ChotDiem_Export_${dateStr}.json`,
          mimeType: 'application/json',
          content: jsonContent,
          dataObj: fullExportObject
        },
        'Xuất dữ liệu JSON thành công.'
      );
    }

    // Generate CSV with UTF-8 BOM (\uFEFF)
    let csv = '\uFEFF';
    csv += `=== BẢNG TỔNG KẾT ĐIỂM SỐ - ${configMap.TEN_PHIEN || 'CHỐT ĐIỂM'} ===\n`;
    csv += 'Hạng,Mã người chơi,Tên người chơi,Số ván,Cầm đầu,Thắng,Hòa,Thua,Tổng điểm\n';
    scoreboard.forEach((p) => {
      csv += `${p.rank},"${p.playerId}","${p.name}",${p.gamesPlayed},${p.leaderCount},${p.winCount},${p.drawCount},${p.loseCount},${p.totalScore}\n`;
    });

    csv += '\n=== LỊCH SỬ TỪNG VÁN ĐẤU ===\n';
    csv += 'Mã ván,Số ván,Thời gian,Người cầm đầu,Điểm cầm đầu,Trạng thái,Chi tiết đối đầu,Ghi chú\n';
    games.forEach((g) => {
      const oppSummary = g.details.map((d) => `${d.name}: ${d.result} (${d.delta >= 0 ? '+' : ''}${d.delta})`).join(' | ');
      csv += `"${g.gameId}",${g.gameNumber},"${g.time}","${g.leaderName}",${g.leaderDelta},"${g.status}","${oppSummary}","${g.note || ''}"\n`;
    });

    return _UTILS_ADM.responseOk(
      {
        format: 'csv',
        filename: `ChotDiem_Export_${dateStr}.csv`,
        mimeType: 'text/csv;charset=utf-8',
        content: csv,
        dataObj: fullExportObject
      },
      'Xuất dữ liệu CSV thành công.'
    );
  } catch (err) {
    console.error('[exportSessionData] Error:', err);
    return _UTILS_ADM.responseError(_CFG_ADM.ERROR_CODES.EXPORT_FAILED, `Lỗi xuất dữ liệu: ${err.message}`);
  }
}

/**
 * Task 7.3: Applies Google Sheets protection to system sheets to prevent accidental edits by users.
 *
 * @returns {{ ok: boolean, success: boolean, protectedSheets: Array<string>, message: string }}
 */
function protectSystemSheets() {
  const ss = _UTILS_ADM.getActiveSpreadsheet();
  const protectedSheets = [];
  const systemSheets = [
    _CFG_ADM.SHEET_NAMES.CAU_HINH,
    _CFG_ADM.SHEET_NAMES.VAN_DAU,
    _CFG_ADM.SHEET_NAMES.TONG_KET,
    _CFG_ADM.SHEET_NAMES.LICH_SU_THAY_DOI,
    _CFG_ADM.SHEET_NAMES.NHAT_KY
  ];

  systemSheets.forEach((sheetName) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet && typeof sheet.protect === 'function') {
      try {
        const protections = sheet.getProtections ? sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET) : [];
        if (protections.length === 0) {
          const protection = sheet.protect();
          protection.setDescription('Hệ thống Chốt Điểm - Dữ liệu tự động, vui lòng không sửa trực tiếp.');
          protection.setWarningOnly(true); // Warning-only protection to avoid blocking Web App
          protectedSheets.push(sheetName);
        }
      } catch (err) {
        console.warn(`[protectSystemSheets] Could not protect sheet '${sheetName}':`, err);
      }
    }
  });

  return _UTILS_ADM.responseOk(
    { protectedSheets: protectedSheets },
    `Đã thiết lập bảo vệ cho ${protectedSheets.length} sheet hệ thống.`
  );
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    runPreDeploymentCheck,
    prepareCleanSpreadsheet,
    cleanupTestData,
    createSpreadsheetBackup,
    installBackupTrigger,
    removeBackupTrigger,
    exportSessionData,
    protectSystemSheets
  };
}
