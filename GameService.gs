/**
 * @fileoverview GameService.gs - Round Management, Validation, Delta Calculations & Lifecycle
 * Google Apps Script V8 Runtime
 */

const _CFG_GAME = typeof CONFIG !== 'undefined' ? CONFIG : (typeof require !== 'undefined' ? require('./Config.gs') : {});
const _UTILS_GAME = typeof responseOk !== 'undefined'
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
      generateNextGameId
    }
  : (typeof require !== 'undefined' ? require('./Utils.gs') : {});

const _SUM_GAME = typeof getScoreboard !== 'undefined'
  ? { getScoreboard }
  : (typeof require !== 'undefined' ? require('./SummaryService.gs') : {});

/**
 * Calculates point delta for a single opponent.
 * @param {string} result - 'WIN' | 'DRAW' | 'LOSE'
 * @param {number} bet - Integer bet >= 0
 * @returns {number} Point delta (+bet, -bet, 0)
 */
function calculatePlayerDelta(result, bet) {
  if (typeof bet !== 'number' || isNaN(bet) || !isFinite(bet) || bet < 0) {
    throw new Error(`Mức cược không hợp lệ: ${bet}.`);
  }
  const norm = String(result || '').trim().toUpperCase();
  switch (norm) {
    case _CFG_GAME.MATCH_RESULT.WIN:
      return bet;
    case _CFG_GAME.MATCH_RESULT.LOSE:
      return bet === 0 ? 0 : -bet;
    case _CFG_GAME.MATCH_RESULT.DRAW:
      return 0;
    default:
      throw new Error(`Kết quả không hợp lệ: '${result}'. Chỉ chấp nhận WIN, DRAW hoặc LOSE.`);
  }
}

/**
 * Calculates point delta for leader A.
 * leaderDelta = -sum(opponentDelta)
 * @param {Array<{ delta: number }>} details - Opponent details
 * @returns {number} Leader delta
 */
function calculateLeaderDelta(details) {
  if (!Array.isArray(details)) return 0;
  const sumOpponents = details.reduce((sum, item) => sum + (Number(item.delta) || 0), 0);
  return sumOpponents === 0 ? 0 : -sumOpponents;
}

/**
 * Calculates total volume of transactions in a round.
 * Formula: sum(abs(opponentDelta))
 * @param {Array<{ delta: number }>} details - Opponent details
 * @returns {number}
 */
function calculateTransactionTotal(details) {
  if (!Array.isArray(details)) return 0;
  return details.reduce((sum, item) => sum + Math.abs(Number(item.delta) || 0), 0);
}

/**
 * Validates a single bet value.
 * @param {any} bet - Bet value
 * @param {string} [fieldName="Mức cược"] - Field name
 * @returns {number} Validated integer bet >= 0
 */
function validateBetNumber(bet, fieldName = 'Mức cược') {
  if (typeof bet !== 'number' || isNaN(bet) || !isFinite(bet)) {
    throw new Error(`${fieldName} phải là một số hợp lệ: ${bet}`);
  }
  if (!Number.isInteger(bet)) {
    throw new Error(`${fieldName} phải là số nguyên: ${bet}`);
  }
  if (bet < 0) {
    throw new Error(`${fieldName} không được là số âm: ${bet}`);
  }
  return bet;
}

/**
 * Saves a new game / round to VAN_DAU sheet.
 * Protected by LockService. Validates inputs, recalculates deltas, and verifies zero-sum.
 * Exactly 1 row is appended per round.
 *
 * @param {Object} gameData - Round payload from frontend
 * @returns {{ ok: boolean, data?: { game: Object, scoreboard: Array<Object> }, error?: Object, message?: string }}
 */
function saveGame(gameData) {
  if (!gameData || typeof gameData !== 'object') {
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_ARGUMENT, 'Dữ liệu ván đấu không được để trống.');
  }

  const rawLeaderId = String(gameData.leaderId || '').trim();
  if (!rawLeaderId) {
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_LEADER, 'Chưa chọn người cầm đầu (A).');
  }

  const rawOpponents = Array.isArray(gameData.opponents)
    ? gameData.opponents
    : (Array.isArray(gameData.details) ? gameData.details : []);

  if (rawOpponents.length === 0) {
    return _UTILS_GAME.responseError(
      _CFG_GAME.ERROR_CODES.INVALID_OPPONENT,
      'Ván đấu phải có ít nhất 1 người đối đầu tham gia.'
    );
  }

  return _UTILS_GAME.withDocumentLock(() => {
    const ss = _UTILS_GAME.getActiveSpreadsheet();
    const playerSheet = ss.getSheetByName(_CFG_GAME.SHEET_NAMES.NGUOI_CHOI);
    const roundSheet = ss.getSheetByName(_CFG_GAME.SHEET_NAMES.VAN_DAU);
    const configSheet = ss.getSheetByName(_CFG_GAME.SHEET_NAMES.CAU_HINH);

    if (!playerSheet || !roundSheet) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.SHEET_NOT_INITIALIZED, 'Các sheet dữ liệu chưa được khởi tạo.');
    }

    // 1. Read session default bet
    let sessionDefaultBet = _CFG_GAME.DEFAULTS.DEFAULT_BET;
    if (configSheet && configSheet.getLastRow() > 1) {
      const cfgValues = configSheet.getRange(2, 1, configSheet.getLastRow() - 1, 2).getValues();
      for (const [k, v] of cfgValues) {
        if (String(k).trim() === _CFG_GAME.CONFIG_KEYS.CUOC_MAC_DINH) {
          const num = parseInt(v, 10);
          if (!isNaN(num) && num >= 0) sessionDefaultBet = num;
        }
      }
    }

    // 2. Read existing players map
    const playerMap = new Map();
    const playerLastRow = playerSheet.getLastRow();
    if (playerLastRow > 1) {
      const pHeaderMap = _UTILS_GAME.getHeaderMap(playerSheet);
      const pValues = playerSheet.getRange(2, 1, playerLastRow - 1, playerSheet.getLastColumn()).getValues();
      const colPId = pHeaderMap.MA_NGUOI_CHOI - 1;
      const colPName = pHeaderMap.TEN_NGUOI_CHOI - 1;
      const colPStatus = pHeaderMap.TRANG_THAI - 1;

      for (const row of pValues) {
        const id = String(row[colPId] || '').trim();
        if (id) {
          playerMap.set(id, {
            playerId: id,
            name: String(row[colPName] || id).trim(),
            status: String(row[colPStatus] || _CFG_GAME.PLAYER_STATUS.DANG_CHOI).trim().toUpperCase()
          });
        }
      }
    }

    // 3. Validate Leader
    const leader = playerMap.get(rawLeaderId);
    if (!leader) {
      return _UTILS_GAME.responseError(
        _CFG_GAME.ERROR_CODES.INVALID_LEADER,
        `Người cầm đầu (${rawLeaderId}) không tồn tại trong danh sách người chơi.`
      );
    }
    if (leader.status !== _CFG_GAME.PLAYER_STATUS.DANG_CHOI) {
      return _UTILS_GAME.responseError(
        _CFG_GAME.ERROR_CODES.INACTIVE_PLAYER,
        `Người cầm đầu '${leader.name}' đang ở trạng thái ngừng chơi.`
      );
    }

    // 4. Validate and sanitize round default bet
    let roundDefaultBet = sessionDefaultBet;
    if (gameData.defaultBet !== undefined && gameData.defaultBet !== null && gameData.defaultBet !== '') {
      try {
        roundDefaultBet = validateBetNumber(Number(gameData.defaultBet), 'Mức cược mặc định của ván');
      } catch (err) {
        return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_BET, err.message);
      }
    }

    // 5. Validate and calculate Opponents
    const seenOpponentIds = new Set();
    const normalizedDetails = [];

    for (let i = 0; i < rawOpponents.length; i++) {
      const opp = rawOpponents[i];
      const pId = String(opp.playerId || '').trim();

      if (!pId) {
        return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_OPPONENT, `Người đối đầu tại vị trí ${i + 1} thiếu mã người chơi.`);
      }

      if (pId === rawLeaderId) {
        return _UTILS_GAME.responseError(
          _CFG_GAME.ERROR_CODES.INVALID_OPPONENT,
          `Người cầm đầu '${leader.name}' không được xuất hiện trong danh sách đối đầu.`
        );
      }

      if (seenOpponentIds.has(pId)) {
        return _UTILS_GAME.responseError(
          _CFG_GAME.ERROR_CODES.DUPLICATE_OPPONENT,
          `Người chơi '${pId}' bị trùng lặp trong danh sách đối đầu của ván.`
        );
      }
      seenOpponentIds.add(pId);

      const player = playerMap.get(pId);
      if (!player) {
        return _UTILS_GAME.responseError(
          _CFG_GAME.ERROR_CODES.INVALID_OPPONENT,
          `Người đối đầu (${pId}) không tồn tại trong danh sách người chơi.`
        );
      }
      if (player.status !== _CFG_GAME.PLAYER_STATUS.DANG_CHOI) {
        return _UTILS_GAME.responseError(
          _CFG_GAME.ERROR_CODES.INACTIVE_PLAYER,
          `Người đối đầu '${player.name}' đang ở trạng thái ngừng chơi.`
        );
      }

      // Default missing result to DRAW as per Phase 1 spec
      let result = String(opp.result || '').trim().toUpperCase();
      if (!result) {
        result = _CFG_GAME.MATCH_RESULT.DRAW;
      }
      if (result !== _CFG_GAME.MATCH_RESULT.WIN && result !== _CFG_GAME.MATCH_RESULT.DRAW && result !== _CFG_GAME.MATCH_RESULT.LOSE) {
        return _UTILS_GAME.responseError(
          _CFG_GAME.ERROR_CODES.INVALID_RESULT,
          `Kết quả của người chơi '${player.name}' không hợp lệ: '${opp.result}'. Chỉ chấp nhận WIN, DRAW hoặc LOSE.`
        );
      }

      // Bet resolution
      let effectiveBet = roundDefaultBet;
      if (opp.bet !== undefined && opp.bet !== null && opp.bet !== '') {
        try {
          effectiveBet = validateBetNumber(Number(opp.bet), `Mức cược của người chơi '${player.name}'`);
        } catch (err) {
          return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_BET, err.message);
        }
      }

      const delta = calculatePlayerDelta(result, effectiveBet);

      normalizedDetails.push({
        playerId: pId,
        name: player.name, // Snapshot name
        result: result,
        bet: effectiveBet,
        delta: delta
      });
    }

    // 6. Leader delta and Zero-sum Invariant verification
    const leaderDelta = calculateLeaderDelta(normalizedDetails);
    const transactionTotal = calculateTransactionTotal(normalizedDetails);

    const sumOpponentsDelta = normalizedDetails.reduce((sum, d) => sum + d.delta, 0);
    if (leaderDelta + sumOpponentsDelta !== 0) {
      return _UTILS_GAME.responseError(
        _CFG_GAME.ERROR_CODES.ZERO_SUM_FAILED,
        `Lỗi bảo toàn điểm số: Tổng delta toàn ván khác 0 (${leaderDelta} + ${sumOpponentsDelta} = ${leaderDelta + sumOpponentsDelta}).`
      );
    }

    // 7. Generate Game ID and sequential Game Number
    const roundHeaderMap = _UTILS_GAME.getHeaderMap(roundSheet);
    const roundLastRow = roundSheet.getLastRow();
    const existingGameIds = [];
    let maxGameNumber = 0;

    if (roundLastRow > 1) {
      const colGameId = roundHeaderMap.MA_VAN - 1;
      const colGameNum = roundHeaderMap.SO_VAN - 1;
      const values = roundSheet.getRange(2, 1, roundLastRow - 1, roundSheet.getLastColumn()).getValues();

      for (const row of values) {
        const gId = String(row[colGameId] || '').trim();
        const gNum = parseInt(row[colGameNum], 10);
        if (gId) existingGameIds.push(gId);
        if (!isNaN(gNum) && gNum > maxGameNumber) maxGameNumber = gNum;
      }
    }

    const nextGameNumber = maxGameNumber + 1;
    const nextGameId = _UTILS_GAME.generateNextGameId(existingGameIds);

    const playedAt = gameData.playedAt ? new Date(gameData.playedAt) : new Date();
    const playedAtDate = isNaN(playedAt.getTime()) ? new Date() : playedAt;

    let cleanNote = _UTILS_GAME.normalizeString(gameData.note);
    if (cleanNote.length > _CFG_GAME.DEFAULTS.MAX_NOTE_LENGTH) {
      cleanNote = cleanNote.substring(0, _CFG_GAME.DEFAULTS.MAX_NOTE_LENGTH);
    }

    const jsonString = _UTILS_GAME.safeJsonStringify(normalizedDetails);

    // 8. Append exactly 1 row to VAN_DAU
    const expectedHeaders = _CFG_GAME.HEADERS.VAN_DAU;
    const newRow = new Array(expectedHeaders.length).fill('');

    newRow[roundHeaderMap.MA_VAN - 1] = nextGameId;
    newRow[roundHeaderMap.SO_VAN - 1] = nextGameNumber;
    newRow[roundHeaderMap.THOI_GIAN - 1] = playedAtDate;
    newRow[roundHeaderMap.MA_NGUOI_CAM_DAU - 1] = leader.playerId;
    newRow[roundHeaderMap.TEN_NGUOI_CAM_DAU - 1] = leader.name;
    newRow[roundHeaderMap.CUOC_MAC_DINH - 1] = roundDefaultBet;
    newRow[roundHeaderMap.CHI_TIET_JSON - 1] = jsonString;
    newRow[roundHeaderMap.DIEM_CAM_DAU - 1] = leaderDelta;
    newRow[roundHeaderMap.TONG_GIAO_DICH - 1] = transactionTotal;
    newRow[roundHeaderMap.GHI_CHU - 1] = cleanNote;
    newRow[roundHeaderMap.TRANG_THAI - 1] = _CFG_GAME.ROUND_STATUS.HOP_LE;

    roundSheet.appendRow(newRow);

    // 9. Recompute scoreboard
    const scoreboardRes = _SUM_GAME.getScoreboard();
    const scoreboard = scoreboardRes.ok ? scoreboardRes.data : [];

    const savedGame = {
      gameId: nextGameId,
      gameNumber: nextGameNumber,
      playedAt: playedAtDate.toISOString(),
      leaderId: leader.playerId,
      leaderName: leader.name,
      defaultBet: roundDefaultBet,
      details: normalizedDetails,
      leaderDelta: leaderDelta,
      transactionTotal: transactionTotal,
      note: cleanNote,
      status: _CFG_GAME.ROUND_STATUS.HOP_LE
    };

    return _UTILS_GAME.responseOk(
      {
        game: savedGame,
        scoreboard: scoreboard
      },
      `Đã lưu ván đấu #${nextGameNumber} thành công.`
    );
  });
}

/**
 * Retrieves match history with parsed details.
 * @param {Object} [options={}] - Options: { includeCancelled?: boolean, limit?: number }
 * @returns {{ ok: boolean, data?: Array<Object>, error?: Object, message?: string }}
 */
function getGameHistory(options = {}) {
  try {
    const ss = _UTILS_GAME.getActiveSpreadsheet();
    const roundSheet = ss.getSheetByName(_CFG_GAME.SHEET_NAMES.VAN_DAU);

    if (!roundSheet) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.SHEET_NOT_INITIALIZED, 'Sheet VAN_DAU chưa được khởi tạo.');
    }

    const lastRow = roundSheet.getLastRow();
    if (lastRow <= 1) {
      return _UTILS_GAME.responseOk([], 'Chưa có ván đấu nào.');
    }

    const headerMap = _UTILS_GAME.getHeaderMap(roundSheet);
    const lastCol = roundSheet.getLastColumn();
    const values = roundSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const colGameId = headerMap.MA_VAN - 1;
    const colGameNum = headerMap.SO_VAN - 1;
    const colTime = headerMap.THOI_GIAN - 1;
    const colLeaderId = headerMap.MA_NGUOI_CAM_DAU - 1;
    const colLeaderName = headerMap.TEN_NGUOI_CAM_DAU - 1;
    const colDefaultBet = headerMap.CUOC_MAC_DINH - 1;
    const colJson = headerMap.CHI_TIET_JSON - 1;
    const colLeaderDelta = headerMap.DIEM_CAM_DAU - 1;
    const colTotalTrans = headerMap.TONG_GIAO_DICH - 1;
    const colNote = headerMap.GHI_CHU - 1;
    const colStatus = headerMap.TRANG_THAI - 1;

    const includeCancelled = options && options.includeCancelled === true;
    const history = [];

    for (let r = 0; r < values.length; r++) {
      const row = values[r];
      const gameId = String(row[colGameId] || '').trim();
      if (!gameId) continue;

      const status = String(row[colStatus] || _CFG_GAME.ROUND_STATUS.HOP_LE).trim().toUpperCase();
      if (!includeCancelled && status === _CFG_GAME.ROUND_STATUS.DA_HUY) {
        continue;
      }

      const rawJson = String(row[colJson] || '');
      const parsedDetails = _UTILS_GAME.safeJsonParse(rawJson, []);

      history.push({
        gameId: gameId,
        gameNumber: parseInt(row[colGameNum], 10) || r + 1,
        playedAt: row[colTime] instanceof Date ? row[colTime].toISOString() : String(row[colTime] || ''),
        leaderId: String(row[colLeaderId] || ''),
        leaderName: String(row[colLeaderName] || ''),
        defaultBet: Number(row[colDefaultBet]) || _CFG_GAME.DEFAULTS.DEFAULT_BET,
        details: Array.isArray(parsedDetails) ? parsedDetails : [],
        leaderDelta: Number(row[colLeaderDelta]) || 0,
        transactionTotal: Number(row[colTotalTrans]) || 0,
        note: String(row[colNote] || ''),
        status: status
      });
    }

    // Sort newest first (gameNumber DESC)
    history.sort((a, b) => b.gameNumber - a.gameNumber);

    if (options && typeof options.limit === 'number' && options.limit > 0) {
      return _UTILS_GAME.responseOk(history.slice(0, options.limit), 'Lấy lịch sử ván đấu thành công.');
    }

    return _UTILS_GAME.responseOk(history, 'Lấy lịch sử ván đấu thành công.');
  } catch (err) {
    console.error('[getGameHistory] Error:', err);
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INTERNAL_ERROR, err.message);
  }
}

/**
 * Retrieves a single game by its unique game ID.
 * @param {string} gameId - Unique ID of the game (e.g. 'V000001')
 * @returns {{ ok: boolean, data?: Object, error?: Object, message?: string }}
 */
function getGameById(gameId) {
  const gId = String(gameId || '').trim();
  if (!gId) {
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_ARGUMENT, 'Mã ván đấu không được để trống.');
  }

  const historyRes = getGameHistory({ includeCancelled: true });
  if (!historyRes.ok) return historyRes;

  const game = (historyRes.data || []).find((g) => g.gameId === gId);
  if (!game) {
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.NOT_FOUND, `Không tìm thấy ván đấu '${gId}'.`);
  }

  return _UTILS_GAME.responseOk(game, `Lấy thông tin ván đấu '${gId}' thành công.`);
}

/**
 * Updates an existing game in-place.
 * Preserves gameId, gameNumber and original playedAt timestamp.
 * Recalculates deltas and verifies zero-sum.
 *
 * @param {string} gameId - Unique ID of game to update
 * @param {Object} gameData - Updated game payload
 * @returns {{ ok: boolean, data?: { game: Object, scoreboard: Array<Object> }, error?: Object, message?: string }}
 */
function updateGame(gameId, gameData) {
  const gId = String(gameId || '').trim();
  if (!gId) {
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_ARGUMENT, 'Mã ván đấu không được để trống.');
  }

  if (!gameData || typeof gameData !== 'object') {
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_ARGUMENT, 'Dữ liệu cập nhật không hợp lệ.');
  }

  return _UTILS_GAME.withDocumentLock(() => {
    const ss = _UTILS_GAME.getActiveSpreadsheet();
    const roundSheet = ss.getSheetByName(_CFG_GAME.SHEET_NAMES.VAN_DAU);
    const playerSheet = ss.getSheetByName(_CFG_GAME.SHEET_NAMES.NGUOI_CHOI);

    if (!roundSheet || !playerSheet) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.SHEET_NOT_INITIALIZED, 'Các sheet dữ liệu chưa được khởi tạo.');
    }

    const lastRow = roundSheet.getLastRow();
    if (lastRow <= 1) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.NOT_FOUND, `Không tìm thấy ván đấu '${gId}'.`);
    }

    const roundHeaderMap = _UTILS_GAME.getHeaderMap(roundSheet);
    const lastCol = roundSheet.getLastColumn();
    const roundValues = roundSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const colGameId = roundHeaderMap.MA_VAN - 1;
    const colStatus = roundHeaderMap.TRANG_THAI - 1;

    let targetRowIdx = -1;
    let currentRow = null;

    for (let r = 0; r < roundValues.length; r++) {
      if (String(roundValues[r][colGameId] || '').trim() === gId) {
        targetRowIdx = r + 2; // 1-based row index
        currentRow = roundValues[r];
        break;
      }
    }

    if (targetRowIdx === -1 || !currentRow) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.NOT_FOUND, `Không tìm thấy ván đấu '${gId}'.`);
    }

    const currentStatus = String(currentRow[colStatus] || '').trim().toUpperCase();
    if (currentStatus === _CFG_GAME.ROUND_STATUS.DA_HUY) {
      return _UTILS_GAME.responseError(
        _CFG_GAME.ERROR_CODES.GAME_CANCELLED,
        'Không thể chỉnh sửa ván đấu đã bị hủy. Hãy khôi phục ván đấu trước.'
      );
    }

    // Read players
    const playerMap = new Map();
    const pValues = playerSheet.getRange(2, 1, playerSheet.getLastRow() - 1, playerSheet.getLastColumn()).getValues();
    const pHeaderMap = _UTILS_GAME.getHeaderMap(playerSheet);
    for (const row of pValues) {
      const id = String(row[pHeaderMap.MA_NGUOI_CHOI - 1] || '').trim();
      if (id) {
        playerMap.set(id, {
          playerId: id,
          name: String(row[pHeaderMap.TEN_NGUOI_CHOI - 1] || id).trim(),
          status: String(row[pHeaderMap.TRANG_THAI - 1] || _CFG_GAME.PLAYER_STATUS.DANG_CHOI).trim().toUpperCase()
        });
      }
    }

    // Leader validation
    const rawLeaderId = String(gameData.leaderId || currentRow[roundHeaderMap.MA_NGUOI_CAM_DAU - 1] || '').trim();
    const leader = playerMap.get(rawLeaderId);
    if (!leader) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_LEADER, `Người cầm đầu '${rawLeaderId}' không tồn tại.`);
    }

    const roundDefaultBet = gameData.defaultBet !== undefined && gameData.defaultBet !== null
      ? validateBetNumber(Number(gameData.defaultBet), 'Mức cược mặc định')
      : Number(currentRow[roundHeaderMap.CUOC_MAC_DINH - 1]) || _CFG_GAME.DEFAULTS.DEFAULT_BET;

    const rawOpponents = Array.isArray(gameData.opponents)
      ? gameData.opponents
      : (Array.isArray(gameData.details) ? gameData.details : []);

    if (rawOpponents.length === 0) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_OPPONENT, 'Ván đấu phải có ít nhất 1 người đối đầu.');
    }

    const seenOpponentIds = new Set();
    const normalizedDetails = [];

    for (const opp of rawOpponents) {
      const pId = String(opp.playerId || '').trim();
      if (!pId || pId === rawLeaderId || seenOpponentIds.has(pId)) {
        return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_OPPONENT, `Người đối đầu '${pId}' không hợp lệ hoặc bị trùng.`);
      }
      seenOpponentIds.add(pId);

      const player = playerMap.get(pId);
      if (!player) {
        return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_OPPONENT, `Người đối đầu '${pId}' không tồn tại.`);
      }

      let result = String(opp.result || '').trim().toUpperCase();
      if (!result) result = _CFG_GAME.MATCH_RESULT.DRAW;
      if (result !== _CFG_GAME.MATCH_RESULT.WIN && result !== _CFG_GAME.MATCH_RESULT.DRAW && result !== _CFG_GAME.MATCH_RESULT.LOSE) {
        return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_RESULT, `Kết quả không hợp lệ: '${opp.result}'.`);
      }

      let effectiveBet = roundDefaultBet;
      if (opp.bet !== undefined && opp.bet !== null && opp.bet !== '') {
        effectiveBet = validateBetNumber(Number(opp.bet), `Mức cược của '${player.name}'`);
      }

      const delta = calculatePlayerDelta(result, effectiveBet);
      normalizedDetails.push({
        playerId: pId,
        name: player.name,
        result: result,
        bet: effectiveBet,
        delta: delta
      });
    }

    const leaderDelta = calculateLeaderDelta(normalizedDetails);
    const transactionTotal = calculateTransactionTotal(normalizedDetails);

    const sumOpponentsDelta = normalizedDetails.reduce((sum, d) => sum + d.delta, 0);
    if (leaderDelta + sumOpponentsDelta !== 0) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.ZERO_SUM_FAILED, 'Lỗi bảo toàn điểm số (Zero-sum violation).');
    }

    let cleanNote = gameData.note !== undefined ? _UTILS_GAME.normalizeString(gameData.note) : String(currentRow[roundHeaderMap.GHI_CHU - 1] || '');
    if (cleanNote.length > _CFG_GAME.DEFAULTS.MAX_NOTE_LENGTH) {
      cleanNote = cleanNote.substring(0, _CFG_GAME.DEFAULTS.MAX_NOTE_LENGTH);
    }

    // Update current row in-place
    currentRow[roundHeaderMap.MA_NGUOI_CAM_DAU - 1] = leader.playerId;
    currentRow[roundHeaderMap.TEN_NGUOI_CAM_DAU - 1] = leader.name;
    currentRow[roundHeaderMap.CUOC_MAC_DINH - 1] = roundDefaultBet;
    currentRow[roundHeaderMap.CHI_TIET_JSON - 1] = _UTILS_GAME.safeJsonStringify(normalizedDetails);
    currentRow[roundHeaderMap.DIEM_CAM_DAU - 1] = leaderDelta;
    currentRow[roundHeaderMap.TONG_GIAO_DICH - 1] = transactionTotal;
    currentRow[roundHeaderMap.GHI_CHU - 1] = cleanNote;

    roundSheet.getRange(targetRowIdx, 1, 1, lastCol).setValues([currentRow]);

    const scoreboardRes = _SUM_GAME.getScoreboard();
    const scoreboard = scoreboardRes.ok ? scoreboardRes.data : [];

    const updatedGame = {
      gameId: gId,
      gameNumber: parseInt(currentRow[roundHeaderMap.SO_VAN - 1], 10),
      playedAt: currentRow[roundHeaderMap.THOI_GIAN - 1] instanceof Date ? currentRow[roundHeaderMap.THOI_GIAN - 1].toISOString() : String(currentRow[roundHeaderMap.THOI_GIAN - 1]),
      leaderId: leader.playerId,
      leaderName: leader.name,
      defaultBet: roundDefaultBet,
      details: normalizedDetails,
      leaderDelta: leaderDelta,
      transactionTotal: transactionTotal,
      note: cleanNote,
      status: currentStatus
    };

    return _UTILS_GAME.responseOk(
      {
        game: updatedGame,
        scoreboard: scoreboard
      },
      `Đã cập nhật ván đấu '${gId}' thành công.`
    );
  });
}

/**
 * Cancels a game (soft delete).
 * Updates status to DA_HUY so it is excluded from scoreboard calculations.
 *
 * @param {string} gameId - Unique ID of game to cancel
 * @returns {{ ok: boolean, data?: { game: Object, scoreboard: Array<Object> }, error?: Object, message?: string }}
 */
function cancelGame(gameId) {
  const gId = String(gameId || '').trim();
  if (!gId) {
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_ARGUMENT, 'Mã ván đấu không được để trống.');
  }

  return _UTILS_GAME.withDocumentLock(() => {
    const ss = _UTILS_GAME.getActiveSpreadsheet();
    const roundSheet = ss.getSheetByName(_CFG_GAME.SHEET_NAMES.VAN_DAU);

    if (!roundSheet) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.SHEET_NOT_INITIALIZED, 'Sheet VAN_DAU chưa được khởi tạo.');
    }

    const lastRow = roundSheet.getLastRow();
    if (lastRow <= 1) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.NOT_FOUND, `Không tìm thấy ván đấu '${gId}'.`);
    }

    const headerMap = _UTILS_GAME.getHeaderMap(roundSheet);
    const lastCol = roundSheet.getLastColumn();
    const values = roundSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const colGameId = headerMap.MA_VAN - 1;
    const colStatus = headerMap.TRANG_THAI - 1;

    for (let r = 0; r < values.length; r++) {
      if (String(values[r][colGameId] || '').trim() === gId) {
        const targetRowIdx = r + 2;
        values[r][colStatus] = _CFG_GAME.ROUND_STATUS.DA_HUY;

        roundSheet.getRange(targetRowIdx, 1, 1, lastCol).setValues([values[r]]);

        const scoreboardRes = _SUM_GAME.getScoreboard();
        const scoreboard = scoreboardRes.ok ? scoreboardRes.data : [];

        const gameRes = getGameById(gId);
        return _UTILS_GAME.responseOk(
          {
            game: gameRes.ok ? gameRes.data : null,
            scoreboard: scoreboard
          },
          `Đã hủy ván đấu '${gId}'.`
        );
      }
    }

    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.NOT_FOUND, `Không tìm thấy ván đấu '${gId}'.`);
  });
}

/**
 * Restores a previously cancelled game (sets status back to HOP_LE).
 * Re-verifies data integrity and recalculates scoreboard.
 *
 * @param {string} gameId - Unique ID of game to restore
 * @returns {{ ok: boolean, data?: { game: Object, scoreboard: Array<Object> }, error?: Object, message?: string }}
 */
function restoreGame(gameId) {
  const gId = String(gameId || '').trim();
  if (!gId) {
    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.INVALID_ARGUMENT, 'Mã ván đấu không được để trống.');
  }

  return _UTILS_GAME.withDocumentLock(() => {
    const ss = _UTILS_GAME.getActiveSpreadsheet();
    const roundSheet = ss.getSheetByName(_CFG_GAME.SHEET_NAMES.VAN_DAU);

    if (!roundSheet) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.SHEET_NOT_INITIALIZED, 'Sheet VAN_DAU chưa được khởi tạo.');
    }

    const lastRow = roundSheet.getLastRow();
    if (lastRow <= 1) {
      return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.NOT_FOUND, `Không tìm thấy ván đấu '${gId}'.`);
    }

    const headerMap = _UTILS_GAME.getHeaderMap(roundSheet);
    const lastCol = roundSheet.getLastColumn();
    const values = roundSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    const colGameId = headerMap.MA_VAN - 1;
    const colStatus = headerMap.TRANG_THAI - 1;
    const colJson = headerMap.CHI_TIET_JSON - 1;
    const colLeaderDelta = headerMap.DIEM_CAM_DAU - 1;

    for (let r = 0; r < values.length; r++) {
      if (String(values[r][colGameId] || '').trim() === gId) {
        const targetRowIdx = r + 2;

        // Verify JSON before restoring
        const rawJson = String(values[r][colJson] || '');
        const details = _UTILS_GAME.safeJsonParse(rawJson, null);
        if (!Array.isArray(details)) {
          return _UTILS_GAME.responseError(
            _CFG_GAME.ERROR_CODES.INVALID_GAME_DATA,
            'Không thể khôi phục ván đấu vì dữ liệu JSON bị hỏng.'
          );
        }

        // Verify zero-sum
        const sumOpponents = details.reduce((sum, d) => sum + (Number(d.delta) || 0), 0);
        const leaderDelta = Number(values[r][colLeaderDelta]) || 0;
        if (leaderDelta + sumOpponents !== 0) {
          return _UTILS_GAME.responseError(
            _CFG_GAME.ERROR_CODES.ZERO_SUM_FAILED,
            'Không thể khôi phục ván đấu vì vi phạm điều kiện bất biến bảo toàn điểm số.'
          );
        }

        values[r][colStatus] = _CFG_GAME.ROUND_STATUS.HOP_LE;
        roundSheet.getRange(targetRowIdx, 1, 1, lastCol).setValues([values[r]]);

        const scoreboardRes = _SUM_GAME.getScoreboard();
        const scoreboard = scoreboardRes.ok ? scoreboardRes.data : [];

        const gameRes = getGameById(gId);
        return _UTILS_GAME.responseOk(
          {
            game: gameRes.ok ? gameRes.data : null,
            scoreboard: scoreboard
          },
          `Đã khôi phục ván đấu '${gId}'.`
        );
      }
    }

    return _UTILS_GAME.responseError(_CFG_GAME.ERROR_CODES.NOT_FOUND, `Không tìm thấy ván đấu '${gId}'.`);
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculatePlayerDelta,
    calculateLeaderDelta,
    calculateTransactionTotal,
    validateBetNumber,
    saveGame,
    getGameHistory,
    getGameById,
    updateGame,
    cancelGame,
    restoreGame
  };
}
