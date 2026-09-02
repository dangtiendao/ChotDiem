/**
 * @fileoverview Spreadsheet schema management and validation module (Phase 1)
 * Compatible with Google Apps Script SpreadsheetApp and Mock Objects.
 */

const { SHEET_NAMES, HEADERS, CONFIG_KEYS, SESSION_STATUS, DEFAULTS } = typeof require !== 'undefined'
  ? require('./constants')
  : {
      SHEET_NAMES: { CAU_HINH: 'CAU_HINH', NGUOI_CHOI: 'NGUOI_CHOI', VAN_DAU: 'VAN_DAU', TONG_KET: 'TONG_KET' },
      HEADERS: {
        CAU_HINH: ['KHOA', 'GIA_TRI'],
        NGUOI_CHOI: ['MA_NGUOI_CHOI', 'TEN_NGUOI_CHOI', 'THU_TU', 'TRANG_THAI', 'THOI_GIAN_THEM'],
        VAN_DAU: ['MA_VAN', 'SO_VAN', 'THOI_GIAN', 'MA_NGUOI_CAM_DAU', 'TEN_NGUOI_CAM_DAU', 'CUOC_MAC_DINH', 'CHI_TIET_JSON', 'DIEM_CAM_DAU', 'TONG_GIAO_DICH', 'GHI_CHU', 'TRANG_THAI'],
        TONG_KET: ['MA_NGUOI_CHOI', 'TEN_NGUOI_CHOI', 'SO_VAN_THAM_GIA', 'SO_LAN_CAM_DAU', 'SO_LAN_THANG', 'SO_LAN_HOA', 'SO_LAN_THUA', 'TONG_DIEM', 'XEP_HANG']
      },
      CONFIG_KEYS: {
        TEN_APP: 'TEN_APP',
        MA_PHIEN: 'MA_PHIEN',
        TEN_PHIEN: 'TEN_PHIEN',
        CUOC_MAC_DINH: 'CUOC_MAC_DINH',
        THOI_GIAN_TAO: 'THOI_GIAN_TAO',
        TRANG_THAI: 'TRANG_THAI',
        TIMEZONE: 'TIMEZONE',
        SCHEMA_VERSION: 'SCHEMA_VERSION'
      },
      SESSION_STATUS: { DANG_CHOI: 'DANG_CHOI' },
      DEFAULTS: { APP_NAME: 'Chốt Điểm', TIMEZONE: 'Asia/Ho_Chi_Minh', SCHEMA_VERSION: '1.0.0', DEFAULT_BET: 5 }
    };

/**
 * Validates the schema of an existing Spreadsheet.
 * Checks for existence of all 4 required sheets and their respective header rows.
 *
 * @param {Object} spreadsheet - SpreadsheetApp.Spreadsheet instance or compatible mock
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateSpreadsheetSchema(spreadsheet) {
  const errors = [];
  const warnings = [];

  if (!spreadsheet) {
    return { valid: false, errors: ['Spreadsheet instance is null or undefined'], warnings: [] };
  }

  for (const sheetKey of Object.keys(SHEET_NAMES)) {
    const sheetName = SHEET_NAMES[sheetKey];
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      errors.push(`Sheet '${sheetName}' is missing.`);
      continue;
    }

    const expectedHeaders = HEADERS[sheetKey];
    const lastColumn = typeof sheet.getLastColumn === 'function' ? sheet.getLastColumn() : 0;

    if (lastColumn < expectedHeaders.length) {
      errors.push(`Sheet '${sheetName}' header is incomplete. Expected at least ${expectedHeaders.length} columns, found ${lastColumn}.`);
      continue;
    }

    // Read first row header values
    let actualHeaders = [];
    if (typeof sheet.getRange === 'function') {
      const headerRange = sheet.getRange(1, 1, 1, expectedHeaders.length);
      actualHeaders = headerRange.getValues()[0];
    } else if (Array.isArray(sheet.headers)) {
      actualHeaders = sheet.headers;
    }

    for (let colIdx = 0; colIdx < expectedHeaders.length; colIdx++) {
      const expected = expectedHeaders[colIdx];
      const actual = actualHeaders[colIdx];
      if (String(actual || '').trim() !== expected) {
        errors.push(`Sheet '${sheetName}' column ${colIdx + 1} header mismatch. Expected '${expected}', found '${actual}'.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Initializes the 4 required sheets in a Spreadsheet if they do not exist.
 * Preserves existing sheets and data.
 *
 * @param {Object} spreadsheet - SpreadsheetApp.Spreadsheet instance or compatible mock
 * @param {Object} [initialConfig={}] - Optional initial configuration values
 * @returns {{ success: boolean, createdSheets: string[], errors: string[] }}
 */
function initializeSpreadsheetStructure(spreadsheet, initialConfig = {}) {
  const createdSheets = [];
  const errors = [];

  if (!spreadsheet) {
    return { success: false, createdSheets: [], errors: ['Invalid spreadsheet reference'] };
  }

  // 1. Sheet CAU_HINH
  let configSheet = spreadsheet.getSheetByName(SHEET_NAMES.CAU_HINH);
  if (!configSheet) {
    configSheet = spreadsheet.insertSheet(SHEET_NAMES.CAU_HINH);
    createdSheets.push(SHEET_NAMES.CAU_HINH);

    // Write header
    configSheet.getRange(1, 1, 1, 2).setValues([HEADERS.CAU_HINH]);

    const nowIso = new Date().toISOString();
    const defaultConfigRows = [
      [CONFIG_KEYS.TEN_APP, initialConfig.appName || DEFAULTS.APP_NAME],
      [CONFIG_KEYS.MA_PHIEN, initialConfig.sessionId || `CP-${Date.now()}`],
      [CONFIG_KEYS.TEN_PHIEN, initialConfig.sessionName || 'Phiên chơi mới'],
      [CONFIG_KEYS.CUOC_MAC_DINH, initialConfig.defaultBet !== undefined ? initialConfig.defaultBet : DEFAULTS.DEFAULT_BET],
      [CONFIG_KEYS.THOI_GIAN_TAO, initialConfig.createdAt || nowIso],
      [CONFIG_KEYS.TRANG_THAI, initialConfig.status || SESSION_STATUS.DANG_CHOI],
      [CONFIG_KEYS.TIMEZONE, initialConfig.timezone || DEFAULTS.TIMEZONE],
      [CONFIG_KEYS.SCHEMA_VERSION, DEFAULTS.SCHEMA_VERSION]
    ];

    configSheet.getRange(2, 1, defaultConfigRows.length, 2).setValues(defaultConfigRows);
  }

  // 2. Sheet NGUOI_CHOI
  let playerSheet = spreadsheet.getSheetByName(SHEET_NAMES.NGUOI_CHOI);
  if (!playerSheet) {
    playerSheet = spreadsheet.insertSheet(SHEET_NAMES.NGUOI_CHOI);
    createdSheets.push(SHEET_NAMES.NGUOI_CHOI);
    playerSheet.getRange(1, 1, 1, HEADERS.NGUOI_CHOI.length).setValues([HEADERS.NGUOI_CHOI]);
  }

  // 3. Sheet VAN_DAU
  let roundSheet = spreadsheet.getSheetByName(SHEET_NAMES.VAN_DAU);
  if (!roundSheet) {
    roundSheet = spreadsheet.insertSheet(SHEET_NAMES.VAN_DAU);
    createdSheets.push(SHEET_NAMES.VAN_DAU);
    roundSheet.getRange(1, 1, 1, HEADERS.VAN_DAU.length).setValues([HEADERS.VAN_DAU]);
  }

  // 4. Sheet TONG_KET
  let summarySheet = spreadsheet.getSheetByName(SHEET_NAMES.TONG_KET);
  if (!summarySheet) {
    summarySheet = spreadsheet.insertSheet(SHEET_NAMES.TONG_KET);
    createdSheets.push(SHEET_NAMES.TONG_KET);
    summarySheet.getRange(1, 1, 1, HEADERS.TONG_KET.length).setValues([HEADERS.TONG_KET]);
  }

  return {
    success: errors.length === 0,
    createdSheets: createdSheets,
    errors: errors
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateSpreadsheetSchema,
    initializeSpreadsheetStructure
  };
}
