/**
 * @fileoverview Code.gs - Main Entry Point, setupApp Initialization and Web App Handlers
 * Google Apps Script V8 Runtime
 */

const _CFG_CODE = typeof CONFIG !== 'undefined' ? CONFIG : (typeof require !== 'undefined' ? require('./Config.gs') : {});
const _UTILS_CODE = typeof responseOk !== 'undefined'
  ? { responseOk, responseError, getActiveSpreadsheet, withDocumentLock, getHeaderMap, formatIsoDate }
  : (typeof require !== 'undefined' ? require('./Utils.gs') : {});

/**
 * Initializes and validates the Spreadsheet structure for the session.
 * Idempotent: Can be safely run multiple times without duplicating or overwriting data.
 *
 * @param {Object} [customConfig={}] - Optional initial configuration values
 * @returns {{ ok: boolean, data?: Object, error?: Object, message?: string }}
 */
function setupApp(customConfig = {}) {
  try {
    const ss = _UTILS_CODE.getActiveSpreadsheet();
    const report = {
      createdSheets: [],
      existingSheets: [],
      addedColumns: {},
      configInitialized: false,
      warnings: []
    };

    // 1. Sheet CAU_HINH
    let configSheet = ss.getSheetByName(_CFG_CODE.SHEET_NAMES.CAU_HINH);
    if (!configSheet) {
      configSheet = ss.insertSheet(_CFG_CODE.SHEET_NAMES.CAU_HINH);
      report.createdSheets.push(_CFG_CODE.SHEET_NAMES.CAU_HINH);

      // Write Header
      configSheet.getRange(1, 1, 1, _CFG_CODE.HEADERS.CAU_HINH.length).setValues([_CFG_CODE.HEADERS.CAU_HINH]);
      configSheet.setFrozenRows(1);
      configSheet.getRange(1, 1, 1, 2).setFontWeight('bold').setBackground('#f3f3f3');

      const nowIso = new Date().toISOString();
      const defaultRows = [
        [_CFG_CODE.CONFIG_KEYS.TEN_APP, customConfig.appName || _CFG_CODE.DEFAULTS.APP_NAME],
        [_CFG_CODE.CONFIG_KEYS.SLOGAN, customConfig.slogan || _CFG_CODE.DEFAULTS.SLOGAN],
        [_CFG_CODE.CONFIG_KEYS.MA_PHIEN, customConfig.sessionId || `CP-${Date.now()}`],
        [_CFG_CODE.CONFIG_KEYS.TEN_PHIEN, customConfig.sessionName || 'Phiên chơi mới'],
        [_CFG_CODE.CONFIG_KEYS.CUOC_MAC_DINH, customConfig.defaultBet !== undefined ? customConfig.defaultBet : _CFG_CODE.DEFAULTS.DEFAULT_BET],
        [_CFG_CODE.CONFIG_KEYS.THOI_GIAN_TAO, customConfig.createdAt || nowIso],
        [_CFG_CODE.CONFIG_KEYS.TRANG_THAI, customConfig.status || _CFG_CODE.SESSION_STATUS.DANG_CHOI],
        [_CFG_CODE.CONFIG_KEYS.TIMEZONE, customConfig.timezone || _CFG_CODE.DEFAULTS.TIMEZONE],
        [_CFG_CODE.CONFIG_KEYS.SCHEMA_VERSION, _CFG_CODE.DEFAULTS.SCHEMA_VERSION]
      ];

      configSheet.getRange(2, 1, defaultRows.length, 2).setValues(defaultRows);
      report.configInitialized = true;
    } else {
      report.existingSheets.push(_CFG_CODE.SHEET_NAMES.CAU_HINH);
    }

    // Helper to ensure table sheets have proper headers without breaking existing data
    function ensureTableSheet(sheetName, expectedHeaders) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        report.createdSheets.push(sheetName);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold').setBackground('#f3f3f3');
      } else {
        report.existingSheets.push(sheetName);
        const lastCol = sheet.getLastColumn();
        if (lastCol === 0) {
          // Empty existing sheet -> write headers
          sheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);
          sheet.setFrozenRows(1);
          sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold').setBackground('#f3f3f3');
        } else {
          // Check for missing columns and append safely
          const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((h) => String(h).trim());
          const missingHeaders = expectedHeaders.filter((h) => !currentHeaders.includes(h));

          if (missingHeaders.length > 0) {
            const startCol = lastCol + 1;
            sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]);
            sheet.getRange(1, startCol, 1, missingHeaders.length).setFontWeight('bold').setBackground('#f3f3f3');
            report.addedColumns[sheetName] = missingHeaders;
          }
        }
      }
    }

    // 2. Sheet NGUOI_CHOI
    ensureTableSheet(_CFG_CODE.SHEET_NAMES.NGUOI_CHOI, _CFG_CODE.HEADERS.NGUOI_CHOI);

    // 3. Sheet VAN_DAU
    ensureTableSheet(_CFG_CODE.SHEET_NAMES.VAN_DAU, _CFG_CODE.HEADERS.VAN_DAU);

    // 4. Sheet TONG_KET
    ensureTableSheet(_CFG_CODE.SHEET_NAMES.TONG_KET, _CFG_CODE.HEADERS.TONG_KET);

    // 5. Sheet LICH_SU_THAY_DOI (Audit log)
    ensureTableSheet(_CFG_CODE.SHEET_NAMES.LICH_SU_THAY_DOI, _CFG_CODE.HEADERS.LICH_SU_THAY_DOI);

    return _UTILS_CODE.responseOk(report, 'Khởi tạo cấu trúc Spreadsheet thành công.');
  } catch (err) {
    console.error('[setupApp] Error:', err);
    return _UTILS_CODE.responseError(_CFG_CODE.ERROR_CODES.INTERNAL_ERROR, err.message);
  }
}

/**
 * Returns basic health and configuration status of the backend.
 * @returns {{ ok: boolean, data?: Object, error?: Object }}
 */
function getAppStatus() {
  try {
    const ss = _UTILS_CODE.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName(_CFG_CODE.SHEET_NAMES.CAU_HINH);
    const playerSheet = ss.getSheetByName(_CFG_CODE.SHEET_NAMES.NGUOI_CHOI);
    const roundSheet = ss.getSheetByName(_CFG_CODE.SHEET_NAMES.VAN_DAU);

    if (!configSheet || !playerSheet || !roundSheet) {
      return _UTILS_CODE.responseError(
        _CFG_CODE.ERROR_CODES.SHEET_NOT_INITIALIZED,
        'Cấu trúc bảng chưa được khởi tạo. Vui lòng chạy setupApp().'
      );
    }

    const configMap = {};
    if (configSheet.getLastRow() > 1) {
      const cfgValues = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
      for (const [k, v] of cfgValues) {
        configMap[String(k).trim()] = v;
      }
    }

    const playerCount = Math.max(0, playerSheet.getLastRow() - 1);
    const roundCount = Math.max(0, roundSheet.getLastRow() - 1);

    return _UTILS_CODE.responseOk({
      appName: configMap[_CFG_CODE.CONFIG_KEYS.TEN_APP] || _CFG_CODE.DEFAULTS.APP_NAME,
      slogan: configMap[_CFG_CODE.CONFIG_KEYS.SLOGAN] || _CFG_CODE.DEFAULTS.SLOGAN,
      sessionId: configMap[_CFG_CODE.CONFIG_KEYS.MA_PHIEN] || '',
      sessionName: configMap[_CFG_CODE.CONFIG_KEYS.TEN_PHIEN] || '',
      defaultBet: configMap[_CFG_CODE.CONFIG_KEYS.CUOC_MAC_DINH] || _CFG_CODE.DEFAULTS.DEFAULT_BET,
      timezone: configMap[_CFG_CODE.CONFIG_KEYS.TIMEZONE] || _CFG_CODE.DEFAULTS.TIMEZONE,
      schemaVersion: configMap[_CFG_CODE.CONFIG_KEYS.SCHEMA_VERSION] || _CFG_CODE.DEFAULTS.SCHEMA_VERSION,
      playerCount: playerCount,
      roundCount: roundCount,
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName()
    }, 'Hệ thống hoạt động bình thường.');
  } catch (err) {
    console.error('[getAppStatus] Error:', err);
    return _UTILS_CODE.responseError(_CFG_CODE.ERROR_CODES.INTERNAL_ERROR, err.message);
  }
}

/**
 * Helper to include partial HTML files (Styles, Scripts, Components) into Index.html.
 * @param {string} filename - Name of HTML file without extension
 * @returns {string} HTML content
 */
function include(filename) {
  if (typeof HtmlService !== 'undefined') {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  }
  return '';
}

/**
 * HTTP GET endpoint for Web App.
 * - Renders the Mobile-First HTML UI when accessed via browser.
 * - Or returns JSON response if '?action=...' parameter is provided.
 *
 * @param {Object} e - Event parameter
 * @returns {GoogleAppsScript.HTML.HtmlOutput | GoogleAppsScript.Content.TextOutput}
 */
function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : null;

  // If action is requested, handle as JSON API endpoint
  if (action) {
    let result;
    switch (action) {
      case 'bootstrap':
      case 'getAppBootstrapData':
        result = typeof getAppBootstrapData === 'function' ? getAppBootstrapData(e.parameter.sessionId) : getAppStatus();
        break;
      case 'status':
        result = getAppStatus();
        break;
      case 'players':
        result = getPlayers(e.parameter.includeInactive === 'true');
        break;
      case 'history':
        result = getGameHistory({
          playerId: e.parameter.playerId,
          leaderId: e.parameter.leaderId,
          result: e.parameter.result,
          fromGameNumber: e.parameter.fromGameNumber,
          toGameNumber: e.parameter.toGameNumber,
          status: e.parameter.status,
          includeCancelled: e.parameter.includeCancelled === 'true',
          limit: parseInt(e.parameter.limit, 10) || undefined
        });
        break;
      case 'detail':
      case 'gameDetail':
        result = getGameDetail(e.parameter.gameId);
        break;
      case 'scoreboard':
        result = getScoreboard(e.parameter.sessionId);
        break;
      case 'preDeploymentCheck':
      case 'runPreDeploymentCheck':
        result = typeof runPreDeploymentCheck === 'function' ? runPreDeploymentCheck() : _UTILS_CODE.responseOk({ status: 'active' });
        break;
      case 'exportData':
      case 'exportSessionData':
        result = typeof exportSessionData === 'function' ? exportSessionData(e.parameter.format) : _UTILS_CODE.responseError(_CFG_CODE.ERROR_CODES.INTERNAL_ERROR, 'Hàm export chưa sẵn sàng');
        break;
      default:
        result = _UTILS_CODE.responseOk({ status: 'active', message: 'Chốt Điểm Apps Script Backend API' });
    }

    if (typeof ContentService !== 'undefined') {
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    return result;
  }

  // Default: Render HTML UI
  if (typeof HtmlService !== 'undefined') {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Chốt Điểm - Chạm nhanh, tính chuẩn, vui trọn cuộc chơi')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return _UTILS_CODE.responseOk({ message: 'HTML Service not available in this environment' });
}

/**
 * HTTP POST endpoint for Web App.
 * Handles API actions with JSON payload.
 *
 * @param {Object} e - Event parameter
 * @returns {GoogleAppsScript.Content.TextOutput} JSON response
 */
function doPost(e) {
  let result;
  try {
    const postData = e && e.postData ? JSON.parse(e.postData.contents) : {};
    const action = postData.action;

    switch (action) {
      case 'bootstrap':
      case 'getAppBootstrapData':
        result = typeof getAppBootstrapData === 'function' ? getAppBootstrapData(postData.sessionId) : getAppStatus();
        break;
      case 'setupApp':
        result = typeof prepareCleanSpreadsheet === 'function' ? prepareCleanSpreadsheet(postData.config) : setupApp(postData.config);
        break;
      case 'prepareCleanSpreadsheet':
        result = typeof prepareCleanSpreadsheet === 'function' ? prepareCleanSpreadsheet(postData.config) : setupApp(postData.config);
        break;
      case 'preDeploymentCheck':
      case 'runPreDeploymentCheck':
        result = typeof runPreDeploymentCheck === 'function' ? runPreDeploymentCheck() : getAppStatus();
        break;
      case 'cleanupTestData':
        result = typeof cleanupTestData === 'function' ? cleanupTestData(postData.options) : _UTILS_CODE.responseError(_CFG_CODE.ERROR_CODES.INTERNAL_ERROR, 'Hàm cleanupTestData chưa sẵn sàng');
        break;
      case 'createBackup':
      case 'createSpreadsheetBackup':
        result = typeof createSpreadsheetBackup === 'function' ? createSpreadsheetBackup(postData.options) : _UTILS_CODE.responseError(_CFG_CODE.ERROR_CODES.INTERNAL_ERROR, 'Hàm createSpreadsheetBackup chưa sẵn sàng');
        break;
      case 'exportData':
      case 'exportSessionData':
        result = typeof exportSessionData === 'function' ? exportSessionData(postData.format) : _UTILS_CODE.responseError(_CFG_CODE.ERROR_CODES.INTERNAL_ERROR, 'Hàm exportSessionData chưa sẵn sàng');
        break;
      case 'protectSheets':
      case 'protectSystemSheets':
        result = typeof protectSystemSheets === 'function' ? protectSystemSheets() : _UTILS_CODE.responseOk({});
        break;
      case 'addPlayer':
        result = addPlayer(postData.name);
        break;
      case 'updatePlayer':
        result = updatePlayer(postData.playerId, postData.data);
        break;
      case 'deactivatePlayer':
        result = deactivatePlayer(postData.playerId);
        break;
      case 'reorderPlayers':
        result = reorderPlayers(postData.playerIds);
        break;
      case 'saveGame':
        result = saveGame(postData.gameData);
        break;
      case 'getGameDetail':
        result = getGameDetail(postData.gameId);
        break;
      case 'updateGame':
        result = updateGame(postData.gameId, postData.gameData, postData.expectedVersion);
        break;
      case 'cancelGame':
        result = cancelGame(postData.gameId, postData.reason, postData.expectedVersion);
        break;
      case 'restoreGame':
        result = restoreGame(postData.gameId, postData.expectedVersion);
        break;
      case 'undoGame':
        result = undoGame(postData.gameId, postData.expectedVersion);
        break;
      case 'getScoreboard':
        result = getScoreboard(postData.sessionId);
        break;
      default:
        result = _UTILS_CODE.responseError(_CFG_CODE.ERROR_CODES.INVALID_ARGUMENT, `Action '${action}' không được hỗ trợ.`);
    }
  } catch (err) {
    result = _UTILS_CODE.responseError(_CFG_CODE.ERROR_CODES.INTERNAL_ERROR, `Lỗi xử lý request: ${err.message}`);
  }

  if (typeof ContentService !== 'undefined') {
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  return result;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    setupApp,
    getAppStatus,
    doGet,
    doPost
  };
}
