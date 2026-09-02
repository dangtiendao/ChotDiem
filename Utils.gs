/**
 * @fileoverview Utils.gs - Shared Utility Functions, Lock Management, Cache & Response Formatting
 * Google Apps Script V8 Runtime - Phase 5 Complete
 */

const _CONFIG = typeof CONFIG !== 'undefined' ? CONFIG : (typeof require !== 'undefined' ? require('./Config.gs') : {});

/**
 * Creates a standardized success response object.
 * @param {any} data - Response payload
 * @param {string} [message=""] - User-friendly message
 * @param {Object} [meta={}] - Metadata (latestGameNumber, etc.)
 * @returns {{ ok: true, success: true, data: any, message: string, errorCode: null, error: null, meta: Object }}
 */
function responseOk(data, message = '', meta = {}) {
  return {
    ok: true,
    success: true,
    data: data !== undefined ? data : null,
    message: String(message || ''),
    errorCode: null,
    error: null,
    meta: {
      serverTimestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Creates a standardized error response object.
 * @param {string} code - Error code from CONFIG.ERROR_CODES
 * @param {string} message - User-friendly error message
 * @param {any} [details=null] - Additional non-sensitive error details
 * @param {Object} [meta={}] - Additional metadata
 * @returns {{ ok: false, success: false, data: null, message: string, errorCode: string, error: Object, meta: Object }}
 */
function responseError(code, message, details = null, meta = {}) {
  const errCode = String(code || _CONFIG.ERROR_CODES.INTERNAL_ERROR);
  const errMsg = String(message || 'Đã xảy ra lỗi không xác định.');
  return {
    ok: false,
    success: false,
    data: null,
    message: errMsg,
    errorCode: errCode,
    error: {
      code: errCode,
      message: errMsg,
      details: details !== undefined ? details : null
    },
    meta: {
      serverTimestamp: new Date().toISOString(),
      ...meta
    }
  };
}

/**
 * Helper to get the active container-bound Spreadsheet.
 * @param {string} [spreadsheetId] - Optional explicit ID for standalone usage
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getActiveSpreadsheet(spreadsheetId) {
  if (typeof SpreadsheetApp === 'undefined') {
    throw new Error('SpreadsheetApp is not available in current environment');
  }

  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (err) {
    // Ignore and fallback to ScriptProperties
  }

  try {
    if (typeof PropertiesService !== 'undefined') {
      const props = PropertiesService.getScriptProperties();
      const ssId = props.getProperty('SPREADSHEET_ID');
      if (ssId) {
        return SpreadsheetApp.openById(ssId);
      }
    }
  } catch (err) {
    console.warn('[getActiveSpreadsheet] Failed to open by SPREADSHEET_ID property:', err);
  }

  throw new Error('Không tìm thấy Spreadsheet. Hãy mở Apps Script từ menu Extensions > Apps Script của Google Sheets hoặc cấu hình SPREADSHEET_ID trong Script Properties.');
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
    return callback();
  }

  let lock = null;
  try {
    lock = LockService.getDocumentLock();
  } catch (e) {
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
 * In-memory fallback cache for Node.js / standalone testing environment.
 */
const _localMemoryCache = new Map();

/**
 * Retrieves cached data using Google Apps Script CacheService.
 * @param {string} key - Cache key
 * @returns {any|null} Parsed cached data or null
 */
function getAppCache(key) {
  try {
    if (typeof CacheService !== 'undefined') {
      const cache = CacheService.getScriptCache();
      const raw = cache.get(String(key));
      return raw ? safeJsonParse(raw, null) : null;
    } else {
      const entry = _localMemoryCache.get(String(key));
      if (entry && entry.expiresAt > Date.now()) {
        return entry.data;
      }
      return null;
    }
  } catch (err) {
    console.warn(`[Cache] Error reading key '${key}':`, err.message);
    return null;
  }
}

/**
 * Stores data in CacheService with TTL.
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} [ttlSeconds=600] - Time to live in seconds (default: 10 mins)
 */
function setAppCache(key, data, ttlSeconds = 600) {
  try {
    if (data === undefined || data === null) return;
    const str = safeJsonStringify(data);
    if (typeof CacheService !== 'undefined') {
      const cache = CacheService.getScriptCache();
      cache.put(String(key), str, Math.min(21600, Math.max(1, ttlSeconds)));
    } else {
      _localMemoryCache.set(String(key), {
        data: data,
        expiresAt: Date.now() + ttlSeconds * 1000
      });
    }
  } catch (err) {
    console.warn(`[Cache] Error setting key '${key}':`, err.message);
  }
}

/**
 * Removes cached key from CacheService.
 * @param {string} key - Cache key to remove
 */
function clearAppCache(key) {
  try {
    if (typeof CacheService !== 'undefined') {
      const cache = CacheService.getScriptCache();
      cache.remove(String(key));
    } else {
      _localMemoryCache.delete(String(key));
    }
  } catch (err) {
    console.warn(`[Cache] Error clearing key '${key}':`, err.message);
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
      map[name] = i + 1;
    }
  }

  return map;
}

/**
 * Fast helper to get latest sequential game number from VAN_DAU sheet without full table scan.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Spreadsheet
 * @returns {number} Latest game number (0 if no games)
 */
function getLatestGameNumber(ss) {
  try {
    if (!ss) return 0;
    const roundSheet = ss.getSheetByName(_CONFIG.SHEET_NAMES.VAN_DAU);
    if (!roundSheet) return 0;
    const lastRow = roundSheet.getLastRow();
    if (lastRow <= 1) return 0;

    const headerMap = getHeaderMap(roundSheet);
    const colGameNum = headerMap.SO_VAN || 2;
    const val = roundSheet.getRange(lastRow, colGameNum, 1, 1).getValue();
    const num = parseInt(val, 10);
    return isNaN(num) ? lastRow - 1 : num;
  } catch (err) {
    console.warn('[getLatestGameNumber] Error:', err);
    return 0;
  }
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

/**
 * Gets current audit version for a game to support optimistic concurrency control.
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss - Active spreadsheet
 * @param {string} gameId - Game ID (e.g. 'V000001')
 * @returns {number} Version number (default 1)
 */
function getGameCurrentVersion(ss, gameId) {
  try {
    if (!ss || !gameId) return 1;
    const auditSheet = ss.getSheetByName(_CONFIG.SHEET_NAMES.LICH_SU_THAY_DOI);
    if (!auditSheet || auditSheet.getLastRow() <= 1) return 1;

    const lastRow = auditSheet.getLastRow();
    const values = auditSheet.getRange(2, 1, lastRow - 1, 9).getValues();
    let maxVersion = 1;

    for (const r of values) {
      if (String(r[1] || '').trim() === gameId) {
        const ver = parseInt(r[8], 10);
        if (!isNaN(ver) && ver >= maxVersion) {
          maxVersion = ver + 1;
        } else {
          maxVersion++;
        }
      }
    }
    return maxVersion;
  } catch (err) {
    console.warn('[getGameCurrentVersion] Error:', err);
    return 1;
  }
}

/**
 * Sanitizes object by removing sensitive fields (tokens, passwords, secrets).
 * @param {Object} obj - Input object
 * @returns {Object} Sanitized object
 */
function sanitizeLogDetails(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  try {
    const sensitiveKeys = ['token', 'password', 'secret', 'auth', 'cookie', 'credential', 'key'];
    const sanitized = Array.isArray(obj) ? [] : {};

    for (const k in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, k)) {
        const isSensitive = sensitiveKeys.some((s) => k.toLowerCase().includes(s));
        if (isSensitive) {
          sanitized[k] = '[REDACTED]';
        } else if (typeof obj[k] === 'object' && obj[k] !== null) {
          sanitized[k] = sanitizeLogDetails(obj[k]);
        } else {
          sanitized[k] = obj[k];
        }
      }
    }
    return sanitized;
  } catch (err) {
    return '[Sanitization Error]';
  }
}

/**
 * Logs an important operational or error event into the NHAT_KY sheet.
 *
 * @param {string} [level="INFO"] - Log level (INFO, WARN, ERROR)
 * @param {string} [code=""] - Error/Event code
 * @param {Object} [context={}] - Context details
 * @param {string} [context.source="BACKEND"] - Source module/component
 * @param {string} [context.handler=""] - Handling function name
 * @param {string} [context.sessionId=""] - Session ID
 * @param {string} [context.gameId=""] - Game ID if applicable
 * @param {string} [context.message=""] - Human-readable summary
 * @param {any} [context.details=null] - Additional details/stack trace
 * @param {string} [context.user="web_user"] - Initiating user/role
 * @param {string} [context.requestId=""] - Request ID
 * @returns {boolean} True if logged successfully
 */
function logImportantEvent(level, code, context = {}) {
  try {
    const lvl = String(level || _CONFIG.LOG_LEVELS.INFO).toUpperCase();
    const cCode = String(code || 'INFO');
    const ctx = context || {};

    console.log(`[${lvl}][${cCode}] ${ctx.message || ''}`, ctx.details || '');

    const ss = getActiveSpreadsheet();
    if (!ss) return false;

    let logSheet = ss.getSheetByName(_CONFIG.SHEET_NAMES.NHAT_KY);
    if (!logSheet) {
      logSheet = ss.insertSheet(_CONFIG.SHEET_NAMES.NHAT_KY);
      logSheet.getRange(1, 1, 1, _CONFIG.HEADERS.NHAT_KY.length).setValues([_CONFIG.HEADERS.NHAT_KY]);
      logSheet.setFrozenRows(1);
    }

    let detailStr = '';
    if (ctx.details) {
      if (typeof ctx.details === 'string') {
        detailStr = ctx.details;
      } else {
        const sanitized = sanitizeLogDetails(ctx.details);
        detailStr = safeJsonStringify(sanitized);
      }
    }

    // Limit length to 5000 chars per cell
    if (detailStr.length > 5000) {
      detailStr = detailStr.substring(0, 4990) + '...[TRUNCATED]';
    }

    const row = [
      new Date(),
      lvl,
      cCode,
      String(ctx.source || 'BACKEND').substring(0, 50),
      String(ctx.handler || '').substring(0, 100),
      String(ctx.sessionId || '').substring(0, 50),
      String(ctx.gameId || '').substring(0, 50),
      String(ctx.message || '').substring(0, 500),
      detailStr,
      String(ctx.user || 'web_user').substring(0, 50),
      String(ctx.requestId || '').substring(0, 100)
    ];

    logSheet.appendRow(row);
    return true;
  } catch (err) {
    console.error('[logImportantEvent] Failed to record log into NHAT_KY:', err);
    return false;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    responseOk,
    responseError,
    getActiveSpreadsheet,
    withDocumentLock,
    getAppCache,
    setAppCache,
    clearAppCache,
    getHeaderMap,
    getLatestGameNumber,
    getGameCurrentVersion,
    normalizeString,
    safeJsonParse,
    safeJsonStringify,
    formatIsoDate,
    generateNextPlayerId,
    generateNextGameId,
    generateNextAuditId,
    recordAuditLog,
    sanitizeLogDetails,
    logImportantEvent
  };
}
