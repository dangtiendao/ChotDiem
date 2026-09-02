/**
 * @fileoverview PlayerService.gs - Player Management Business Logic with Caching (Phase 5)
 * Google Apps Script V8 Runtime
 */

const _CFG_PLAYER = typeof CONFIG !== 'undefined' ? CONFIG : (typeof require !== 'undefined' ? require('./Config.gs') : {});
const _UTILS_PLAYER = typeof responseOk !== 'undefined'
  ? { responseOk, responseError, getActiveSpreadsheet, withDocumentLock, getAppCache, setAppCache, clearAppCache, getHeaderMap, normalizeString, generateNextPlayerId }
  : (typeof require !== 'undefined' ? require('./Utils.gs') : {});

/**
 * Retrieves the list of players in the current session.
 * Uses CacheService for high-speed retrieval if available.
 *
 * @param {boolean} [includeInactive=false] - Whether to include deactivated (NGUNG_CHOI) players
 * @returns {{ ok: boolean, success: boolean, data?: Array<Object>, error?: Object, message?: string }}
 */
function getPlayers(includeInactive = false) {
  try {
    const cacheKey = `${_CFG_PLAYER.CACHE_KEYS.PLAYERS}_${includeInactive ? 'ALL' : 'ACTIVE'}`;

    if (typeof _UTILS_PLAYER.getAppCache === 'function') {
      const cached = _UTILS_PLAYER.getAppCache(cacheKey);
      if (cached && Array.isArray(cached)) {
        return _UTILS_PLAYER.responseOk(cached, 'Lấy danh sách người chơi từ cache thành công.');
      }
    }

    const ss = _UTILS_PLAYER.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(_CFG_PLAYER.SHEET_NAMES.NGUOI_CHOI);

    if (!sheet) {
      return _UTILS_PLAYER.responseError(
        _CFG_PLAYER.ERROR_CODES.SHEET_NOT_INITIALIZED,
        `Sheet '${_CFG_PLAYER.SHEET_NAMES.NGUOI_CHOI}' chưa được khởi tạo. Vui lòng chạy setupApp() trước.`
      );
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return _UTILS_PLAYER.responseOk([], 'Danh sách người chơi trống.');
    }

    const headerMap = _UTILS_PLAYER.getHeaderMap(sheet);
    const lastCol = sheet.getLastColumn();
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const colId = headerMap.MA_NGUOI_CHOI - 1;
    const colName = headerMap.TEN_NGUOI_CHOI - 1;
    const colOrder = headerMap.THU_TU - 1;
    const colStatus = headerMap.TRANG_THAI - 1;
    const colJoined = headerMap.THOI_GIAN_THEM - 1;

    const players = [];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const pId = String(row[colId] || '').trim();
      if (!pId) continue;

      const status = String(row[colStatus] || _CFG_PLAYER.PLAYER_STATUS.DANG_CHOI).trim().toUpperCase();
      const isActive = status === _CFG_PLAYER.PLAYER_STATUS.DANG_CHOI;

      if (!includeInactive && !isActive) {
        continue;
      }

      const orderVal = parseInt(row[colOrder], 10);

      players.push({
        playerId: pId,
        name: String(row[colName] || pId).trim(),
        order: isNaN(orderVal) ? i + 1 : orderVal,
        status: status,
        active: isActive,
        joinedAt: row[colJoined] instanceof Date ? row[colJoined].toISOString() : String(row[colJoined] || '')
      });
    }

    players.sort((a, b) => a.order - b.order);

    if (typeof _UTILS_PLAYER.setAppCache === 'function') {
      _UTILS_PLAYER.setAppCache(cacheKey, players, _CFG_PLAYER.CACHE_KEYS.TTL_SECONDS);
    }

    return _UTILS_PLAYER.responseOk(players, 'Lấy danh sách người chơi thành công.');
  } catch (err) {
    console.error('[getPlayers] Error:', err);
    return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.INTERNAL_ERROR, err.message);
  }
}

/**
 * Invalidates player caches.
 */
function invalidatePlayerCache() {
  if (typeof _UTILS_PLAYER.clearAppCache === 'function') {
    _UTILS_PLAYER.clearAppCache(`${_CFG_PLAYER.CACHE_KEYS.PLAYERS}_ALL`);
    _UTILS_PLAYER.clearAppCache(`${_CFG_PLAYER.CACHE_KEYS.PLAYERS}_ACTIVE`);
  }
}

/**
 * Adds a new player to the session.
 * Protected by LockService to prevent concurrent duplicate adds.
 *
 * @param {string} name - Player display name
 * @returns {{ ok: boolean, success: boolean, data?: Object, error?: Object, message?: string }}
 */
function addPlayer(name) {
  const cleanName = _UTILS_PLAYER.normalizeString(name);

  if (!cleanName) {
    return _UTILS_PLAYER.responseError(
      _CFG_PLAYER.ERROR_CODES.VALIDATION_ERROR,
      'Tên người chơi không được để trống.'
    );
  }

  if (cleanName.length > _CFG_PLAYER.DEFAULTS.MAX_PLAYER_NAME_LENGTH) {
    return _UTILS_PLAYER.responseError(
      _CFG_PLAYER.ERROR_CODES.VALIDATION_ERROR,
      `Tên người chơi tối đa ${_CFG_PLAYER.DEFAULTS.MAX_PLAYER_NAME_LENGTH} ký tự.`
    );
  }

  return _UTILS_PLAYER.withDocumentLock(() => {
    const ss = _UTILS_PLAYER.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(_CFG_PLAYER.SHEET_NAMES.NGUOI_CHOI);

    if (!sheet) {
      return _UTILS_PLAYER.responseError(
        _CFG_PLAYER.ERROR_CODES.SHEET_NOT_INITIALIZED,
        `Sheet '${_CFG_PLAYER.SHEET_NAMES.NGUOI_CHOI}' chưa được khởi tạo. Vui lòng chạy setupApp().`
      );
    }

    const headerMap = _UTILS_PLAYER.getHeaderMap(sheet);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    const existingIds = [];
    let maxOrder = 0;

    if (lastRow > 1) {
      const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      const colId = headerMap.MA_NGUOI_CHOI - 1;
      const colName = headerMap.TEN_NGUOI_CHOI - 1;
      const colOrder = headerMap.THU_TU - 1;

      for (const row of values) {
        const id = String(row[colId] || '').trim();
        const pName = String(row[colName] || '').trim();
        const pOrder = parseInt(row[colOrder], 10);

        if (id) {
          existingIds.push(id);
        }

        if (!isNaN(pOrder) && pOrder > maxOrder) {
          maxOrder = pOrder;
        }

        if (pName.toLowerCase() === cleanName.toLowerCase()) {
          return _UTILS_PLAYER.responseError(
            _CFG_PLAYER.ERROR_CODES.DUPLICATE_PLAYER,
            `Người chơi với tên '${cleanName}' đã tồn tại trong phiên chơi.`
          );
        }
      }
    }

    const newPlayerId = _UTILS_PLAYER.generateNextPlayerId(existingIds);
    const nextOrder = maxOrder + 1;
    const now = new Date();

    const expectedHeaders = _CFG_PLAYER.HEADERS.NGUOI_CHOI;
    const newRow = new Array(expectedHeaders.length).fill('');

    newRow[headerMap.MA_NGUOI_CHOI - 1] = newPlayerId;
    newRow[headerMap.TEN_NGUOI_CHOI - 1] = cleanName;
    newRow[headerMap.THU_TU - 1] = nextOrder;
    newRow[headerMap.TRANG_THAI - 1] = _CFG_PLAYER.PLAYER_STATUS.DANG_CHOI;
    newRow[headerMap.THOI_GIAN_THEM - 1] = now;

    sheet.appendRow(newRow);

    invalidatePlayerCache();

    const createdPlayer = {
      playerId: newPlayerId,
      name: cleanName,
      order: nextOrder,
      status: _CFG_PLAYER.PLAYER_STATUS.DANG_CHOI,
      active: true,
      joinedAt: now.toISOString()
    };

    return _UTILS_PLAYER.responseOk(createdPlayer, `Đã thêm người chơi '${cleanName}' thành công.`);
  });
}

/**
 * Updates an existing player's display name or status.
 * @param {string} playerId - ID of the player to update (e.g. 'P001')
 * @param {Object} data - Update payload: { name?: string, status?: string }
 * @returns {{ ok: boolean, success: boolean, data?: Object, error?: Object, message?: string }}
 */
function updatePlayer(playerId, data) {
  const pId = String(playerId || '').trim();
  if (!pId) {
    return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.INVALID_ARGUMENT, 'Mã người chơi không được để trống.');
  }

  if (!data || typeof data !== 'object') {
    return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.INVALID_ARGUMENT, 'Dữ liệu cập nhật không hợp lệ.');
  }

  return _UTILS_PLAYER.withDocumentLock(() => {
    const ss = _UTILS_PLAYER.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(_CFG_PLAYER.SHEET_NAMES.NGUOI_CHOI);

    if (!sheet) {
      return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.SHEET_NOT_INITIALIZED, 'Sheet NGUOI_CHOI chưa được khởi tạo.');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.NOT_FOUND, `Không tìm thấy người chơi '${pId}'.`);
    }

    const headerMap = _UTILS_PLAYER.getHeaderMap(sheet);
    const lastCol = sheet.getLastColumn();
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const colId = headerMap.MA_NGUOI_CHOI - 1;
    const colName = headerMap.TEN_NGUOI_CHOI - 1;
    const colStatus = headerMap.TRANG_THAI - 1;
    const colOrder = headerMap.THU_TU - 1;
    const colJoined = headerMap.THOI_GIAN_THEM - 1;

    let targetRowIndex = -1;
    let currentRow = null;

    let cleanNewName = data.name !== undefined ? _UTILS_PLAYER.normalizeString(data.name) : null;
    if (cleanNewName !== null) {
      if (!cleanNewName) {
        return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.VALIDATION_ERROR, 'Tên người chơi không được để trống.');
      }
      if (cleanNewName.length > _CFG_PLAYER.DEFAULTS.MAX_PLAYER_NAME_LENGTH) {
        return _UTILS_PLAYER.responseError(
          _CFG_PLAYER.ERROR_CODES.VALIDATION_ERROR,
          `Tên người chơi tối đa ${_CFG_PLAYER.DEFAULTS.MAX_PLAYER_NAME_LENGTH} ký tự.`
        );
      }
    }

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const id = String(row[colId] || '').trim();
      const existingName = String(row[colName] || '').trim();

      if (id === pId) {
        targetRowIndex = i + 2;
        currentRow = row;
      } else if (cleanNewName !== null && existingName.toLowerCase() === cleanNewName.toLowerCase()) {
        return _UTILS_PLAYER.responseError(
          _CFG_PLAYER.ERROR_CODES.DUPLICATE_PLAYER,
          `Tên '${cleanNewName}' đã được sử dụng bởi người chơi khác (${id}).`
        );
      }
    }

    if (targetRowIndex === -1 || !currentRow) {
      return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.NOT_FOUND, `Không tìm thấy người chơi '${pId}'.`);
    }

    if (cleanNewName !== null) {
      currentRow[colName] = cleanNewName;
    }

    if (data.status !== undefined) {
      const normStatus = String(data.status).trim().toUpperCase();
      if (normStatus === _CFG_PLAYER.PLAYER_STATUS.DANG_CHOI || normStatus === _CFG_PLAYER.PLAYER_STATUS.NGUNG_CHOI) {
        currentRow[colStatus] = normStatus;
      }
    }

    sheet.getRange(targetRowIndex, 1, 1, lastCol).setValues([currentRow]);

    invalidatePlayerCache();

    const updatedStatus = String(currentRow[colStatus] || _CFG_PLAYER.PLAYER_STATUS.DANG_CHOI);
    const updatedPlayer = {
      playerId: pId,
      name: String(currentRow[colName]),
      order: parseInt(currentRow[colOrder], 10) || 0,
      status: updatedStatus,
      active: updatedStatus === _CFG_PLAYER.PLAYER_STATUS.DANG_CHOI,
      joinedAt: currentRow[colJoined] instanceof Date ? currentRow[colJoined].toISOString() : String(currentRow[colJoined] || '')
    };

    return _UTILS_PLAYER.responseOk(updatedPlayer, `Đã cập nhật thông tin người chơi '${pId}'.`);
  });
}

/**
 * Soft-deactivates a player (marks status as NGUNG_CHOI).
 * Does NOT delete row or historical match data.
 *
 * @param {string} playerId - ID of the player to deactivate
 * @returns {{ ok: boolean, success: boolean, data?: Object, error?: Object, message?: string }}
 */
function deactivatePlayer(playerId) {
  const pId = String(playerId || '').trim();
  if (!pId) {
    return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.INVALID_ARGUMENT, 'Mã người chơi không được để trống.');
  }

  return updatePlayer(pId, { status: _CFG_PLAYER.PLAYER_STATUS.NGUNG_CHOI });
}

/**
 * Reorders active players by updating their display order (THU_TU).
 * @param {string[]} playerIds - Ordered array of all active player IDs
 * @returns {{ ok: boolean, success: boolean, data?: Array<Object>, error?: Object, message?: string }}
 */
function reorderPlayers(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.INVALID_ARGUMENT, 'Danh sách thứ tự người chơi phải là một mảng không rỗng.');
  }

  const uniqueIds = new Set(playerIds);
  if (uniqueIds.size !== playerIds.length) {
    return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.VALIDATION_ERROR, 'Danh sách sắp xếp chứa mã người chơi bị trùng lặp.');
  }

  return _UTILS_PLAYER.withDocumentLock(() => {
    const ss = _UTILS_PLAYER.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(_CFG_PLAYER.SHEET_NAMES.NGUOI_CHOI);

    if (!sheet) {
      return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.SHEET_NOT_INITIALIZED, 'Sheet NGUOI_CHOI chưa được khởi tạo.');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return _UTILS_PLAYER.responseError(_CFG_PLAYER.ERROR_CODES.NOT_FOUND, 'Chưa có người chơi nào để sắp xếp.');
    }

    const headerMap = _UTILS_PLAYER.getHeaderMap(sheet);
    const lastCol = sheet.getLastColumn();
    const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const colId = headerMap.MA_NGUOI_CHOI - 1;
    const colOrder = headerMap.THU_TU - 1;

    const rowIndexMap = new Map();
    for (let i = 0; i < values.length; i++) {
      const id = String(values[i][colId] || '').trim();
      if (id) {
        rowIndexMap.set(id, i);
      }
    }

    for (const id of playerIds) {
      if (!rowIndexMap.has(id)) {
        return _UTILS_PLAYER.responseError(
          _CFG_PLAYER.ERROR_CODES.NOT_FOUND,
          `Người chơi '${id}' trong danh sách sắp xếp không tồn tại.`
        );
      }
    }

    for (let newOrder = 0; newOrder < playerIds.length; newOrder++) {
      const pId = playerIds[newOrder];
      const rowIndex = rowIndexMap.get(pId);
      values[rowIndex][colOrder] = newOrder + 1;
    }

    sheet.getRange(2, 1, values.length, lastCol).setValues(values);

    invalidatePlayerCache();

    return getPlayers(false);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getPlayers,
    addPlayer,
    updatePlayer,
    deactivatePlayer,
    reorderPlayers,
    invalidatePlayerCache
  };
}
