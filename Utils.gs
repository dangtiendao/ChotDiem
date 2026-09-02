/**
 * @fileoverview Utils.gs - Shared Utility Functions, Lock Management and Response Formatting
 * Google Apps Script V8 Runtime
 */

const _CONFIG = typeof CONFIG !== 'undefined' ? CONFIG : (typeof require !== 'undefined' ? require('./Config.gs') : {});

/**
 * Creates a standard success response object.
 * @param {any} data - Response payload
 * @param {string} [message=""] - User-friendly message
 * @returns {{ ok: true, data: any, message: string }}
 */
function responseOk(data, message = '') {
  return {
    ok: true,
    data: data !== undefined ? data : null,
    message: String(message || '')
  };
}

/**
 * Creates a standard error response object.
 * @param {string} code - Error code from CONFIG.ERROR_CODES
 * @param {string} message - User-friendly error message
 * @param {any} [details=null] - Additional error details (non-sensitive)
 * @returns {{ ok: false, error: { code: string, message: string, details: any } }}
 */
function responseError(code, message, details = null) {
  return {
    ok: false,
    error: {
      code: String(code || _CONFIG.ERROR_CODES.INTERNAL_ERROR),
      message: String(message || 'Đã xảy ra lỗi không xác định.'),
      details: details !== undefined ? details : null
    }
  };
}

/**
 * Helper to get the active container-bound Spreadsheet.
 * @param {string} [spreadsheetId] - Optional explicit ID for testing/standalone usage
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getActiveSpreadsheet(spreadsheetId) {
  if (typeof SpreadsheetApp === 'undefined') {
    throw new Error('SpreadsheetApp is not available in current environment');
  }

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Không tìm thấy Spreadsheet đang liên kết. Hãy mở Apps Script từ menu Extensions > Apps Script của Google Sheets.');
  }
  return active;
}

/**
 * Executes a callback with Document Lock to prevent race conditions during write operations.
 * Safely acquires and releases lock, handling timeouts gracefully.
 *
 * @param {Function} callback - Function to execute inside critical section
 * @param {number} [timeoutMs] - Timeout in milliseconds (default: CONFIG.DEFAULTS.LOCK_TIMEOUT_MS)
 * @returns {any} Result of the callback function
 */
function withDocumentLock(callback, timeoutMs) {
  const timeout = timeoutMs || _CONFIG.DEFAULTS.LOCK_TIMEOUT_MS;

  if (typeof LockService === 'undefined') {
    // If running in local test environment without Apps Script mock, execute directly
    return callback();
  }

  let lock = null;
  try {
    lock = LockService.getDocumentLock();
  } catch (e) {
    // Fallback to script lock if container document lock is unavailable
    lock = LockService.getScriptLock();
  }

  if (!lock) {
    lock = LockService.getScriptLock();
  }

  const acquired = lock.tryLock(timeout);
  if (!acquired) {
    console.warn(`[LockService] Timeout (${timeout}ms) waiting for document lock.`);
    throw new Error(`${_CONFIG.ERROR_CODES.LOCK_TIMEOUT}: Hệ thống đang bận xử lý giao dịch khác, vui lòng thử lại sau giây lát.`);
  }

  try {
    return callback();
  } finally {
    try {
      lock.releaseLock();
    } catch (releaseErr) {
      console.error('[LockService] Error releasing lock:', releaseErr);
    }
  }
}

/**
 * Reads header row of a sheet and builds a 1-based column mapping index: { [headerName]: colIndex }
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - Google Sheet instance
 * @returns {Object<string, number>} Map of header names to 1-based column indices
 */
function getHeaderMap(sheet) {
  if (!sheet) {
    throw new Error('Sheet is required to build header map.');
  }

  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) {
    return {};
  }

  const headerRow = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const map = {};

  for (let i = 0; i < headerRow.length; i++) {
    const name = String(headerRow[i] || '').trim();
    if (name) {
      map[name] = i + 1; // 1-based column index
    }
  }

  return map;
}

/**
 * Trims and collapses multiple whitespace characters into single space.
 * @param {string} str - Input string
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (str === null || str === undefined) return '';
  return String(str).trim().replace(/\s+/g, ' ');
}

/**
 * Safely parses a JSON string with fallback.
 * @param {string} jsonStr - String to parse
 * @param {any} [fallback=null] - Fallback value on failure
 * @returns {any} Parsed object or fallback
 */
function safeJsonParse(jsonStr, fallback = null) {
  if (!jsonStr || typeof jsonStr !== 'string') return fallback;
  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    console.warn(`[safeJsonParse] Failed to parse JSON: ${err.message}`, jsonStr);
    return fallback;
  }
}

/**
 * Safely converts an object to JSON string.
 * @param {any} data - Object to stringify
 * @returns {string}
 */
function safeJsonStringify(data) {
  try {
    return JSON.stringify(data);
  } catch (err) {
    console.error(`[safeJsonStringify] Failed to stringify data: ${err.message}`, data);
    return '[]';
  }
}

/**
 * Formats a Date object to ISO 8601 string.
 * @param {Date | string | number} date - Date to format
 * @returns {string} ISO 8601 string (e.g. 2026-09-02T19:00:00.000Z)
 */
function formatIsoDate(date) {
  if (!date) return new Date().toISOString();
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

/**
 * Generates the next sequential Player ID (e.g. P001, P002...).
 * @param {string[]} existingIds - Array of existing player IDs
 * @returns {string} Next player ID
 */
function generateNextPlayerId(existingIds = []) {
  let maxNum = 0;
  for (const id of existingIds) {
    const match = String(id || '').match(/^P(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNum = maxNum + 1;
  return `P${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generates the next sequential Game ID (e.g. V000001, V000002...).
 * @param {string[]} existingIds - Array of existing round IDs
 * @returns {string} Next round ID
 */
function generateNextGameId(existingIds = []) {
  let maxNum = 0;
  for (const id of existingIds) {
    const match = String(id || '').match(/^V(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNum = maxNum + 1;
  return `V${String(nextNum).padStart(6, '0')}`;
}

/**
 * Generates the next sequential Audit ID (e.g. A000001, A000002...).
 * @param {string[]} existingIds - Array of existing audit IDs
 * @returns {string} Next audit ID
 */
function generateNextAuditId(existingIds = []) {
  let maxNum = 0;
  for (const id of existingIds) {
    const match = String(id || '').match(/^A(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  const nextNum = maxNum + 1;
  return `A${String(nextNum).padStart(6, '0')}`;
}

/**
 * Records an audit snapshot entry into LICH_SU_THAY_DOI sheet.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Active spreadsheet
 * @param {Object} entry - { gameId, action, beforeData, afterData, reason, version, user }
 * @returns {string} Generated Audit ID
 */
function recordAuditLog(ss, entry) {
  try {
    if (!ss) return null;
    let auditSheet = ss.getSheetByName(_CONFIG.SHEET_NAMES.LICH_SU_THAY_DOI);
    if (!auditSheet) {
      auditSheet = ss.insertSheet(_CONFIG.SHEET_NAMES.LICH_SU_THAY_DOI);
      auditSheet.getRange(1, 1, 1, _CONFIG.HEADERS.LICH_SU_THAY_DOI.length).setValues([_CONFIG.HEADERS.LICH_SU_THAY_DOI]);
      auditSheet.setFrozenRows(1);
    }

    const lastRow = auditSheet.getLastRow();
    const existingIds = [];
    if (lastRow > 1) {
      const values = auditSheet.getRange(2, 1, lastRow - 1, 1).getValues();
      for (const r of values) {
        if (r[0]) existingIds.push(String(r[0]));
      }
    }

    const auditId = generateNextAuditId(existingIds);
    const now = new Date();

    const row = [
      auditId,
      entry.gameId || '',
      entry.action || _CONFIG.AUDIT_ACTION.EDIT,
      typeof entry.beforeData === 'object' ? safeJsonStringify(entry.beforeData) : String(entry.beforeData || ''),
      typeof entry.afterData === 'object' ? safeJsonStringify(entry.afterData) : String(entry.afterData || ''),
      now,
      entry.user || 'web_user',
      entry.reason || '',
      entry.version || 1
    ];

    auditSheet.appendRow(row);
    return auditId;
  } catch (err) {
    console.error('[recordAuditLog] Error writing audit log:', err);
    return null;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    responseOk,
    responseError,
    getActiveSpreadsheet,
    withDocumentLock,
    getHeaderMap,
    normalizeString,
    safeJsonParse,
    safeJsonStringify,
    formatIsoDate,
    generateNextPlayerId,
    generateNextGameId,
    generateNextAuditId,
    recordAuditLog
  };
}
