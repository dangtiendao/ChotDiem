/**
 * @fileoverview Validation and normalization module for Web App "Chốt Điểm" (Phase 1)
 */

const {
  MATCH_RESULT,
  PLAYER_STATUS,
  ROUND_STATUS,
  SESSION_STATUS,
  DEFAULTS
} = typeof require !== 'undefined'
  ? require('./constants')
  : {
      MATCH_RESULT: { WIN: 'WIN', DRAW: 'DRAW', LOSE: 'LOSE' },
      PLAYER_STATUS: { DANG_CHOI: 'DANG_CHOI', NGUNG_CHOI: 'NGUNG_CHOI' },
      ROUND_STATUS: { HOP_LE: 'HOP_LE', DA_HUY: 'DA_HUY' },
      SESSION_STATUS: { DANG_CHOI: 'DANG_CHOI', DA_KET_THUC: 'DA_KET_THUC' },
      DEFAULTS: { DEFAULT_BET: 5, MAX_NOTE_LENGTH: 500 }
    };

const { calculatePlayerDelta, calculateLeaderDelta, calculateTransactionTotal } = typeof require !== 'undefined'
  ? require('./scoring')
  : {
      calculatePlayerDelta: (r, b) => (r === 'WIN' ? b : r === 'LOSE' ? -b : 0),
      calculateLeaderDelta: (d) => -d.reduce((s, x) => s + x.delta, 0),
      calculateTransactionTotal: (d) => d.reduce((s, x) => s + Math.abs(x.delta), 0)
    };

/**
 * Validates a bet amount. Must be an integer >= 0.
 * @param {any} bet - Value to check
 * @param {string} [fieldName='Mức cược'] - Field name for error reporting
 * @returns {number} Validated integer bet
 */
function validateBet(bet, fieldName = 'Mức cược') {
  if (typeof bet !== 'number' || isNaN(bet) || !isFinite(bet)) {
    throw new Error(`${fieldName} phải là một số hợp lệ. Nhận được: ${bet}`);
  }
  if (!Number.isInteger(bet)) {
    throw new Error(`${fieldName} phải là số nguyên. Không chấp nhận số thập phân: ${bet}`);
  }
  if (bet < 0) {
    throw new Error(`${fieldName} không được là số âm: ${bet}`);
  }
  return bet;
}

/**
 * Normalizes and validates match result.
 * @param {string} result - 'WIN' | 'DRAW' | 'LOSE'
 * @returns {'WIN' | 'DRAW' | 'LOSE'}
 */
function validateResult(result) {
  const norm = String(result || '').trim().toUpperCase();
  if (norm !== MATCH_RESULT.WIN && norm !== MATCH_RESULT.DRAW && norm !== MATCH_RESULT.LOSE) {
    throw new Error(`Kết quả không hợp lệ: '${result}'. Chỉ chấp nhận WIN, DRAW hoặc LOSE.`);
  }
  return norm;
}

/**
 * Normalizes raw round input into a structured, validated Round object.
 * Missing opponent results are automatically defaulted to 'DRAW'.
 * Missing bets are automatically defaulted to defaultBet.
 *
 * @param {Object} input - Raw round input
 * @param {number} sessionDefaultBet - Default bet from session config
 * @param {Array<Object>} existingPlayers - Array of active players
 * @returns {Object} Normalized round object
 */
function normalizeRoundInput(input, sessionDefaultBet = DEFAULTS.DEFAULT_BET, existingPlayers = []) {
  if (!input || typeof input !== 'object') {
    throw new Error('Dữ liệu ván đấu không được để trống.');
  }

  const leaderId = String(input.leaderId || input.MA_NGUOI_CAM_DAU || '').trim();
  if (!leaderId) {
    throw new Error('Chưa chọn người cầm đầu (A).');
  }

  const roundDefaultBet = validateBet(
    input.defaultBet !== undefined && input.defaultBet !== null
      ? Number(input.defaultBet)
      : Number(sessionDefaultBet),
    'Mức cược mặc định của ván'
  );

  const rawDetails = Array.isArray(input.details)
    ? input.details
    : Array.isArray(input.opponents)
    ? input.opponents
    : [];

  const playerMap = new Map();
  if (Array.isArray(existingPlayers)) {
    for (const p of existingPlayers) {
      const id = String(p.playerId || p.MA_NGUOI_CHOI || '').trim();
      if (id) playerMap.set(id, p);
    }
  }

  const normalizedDetails = rawDetails.map((opp) => {
    const pId = String(opp.playerId || opp.MA_NGUOI_CHOI || '').trim();
    const existingPlayer = playerMap.get(pId);
    const pName = String(opp.name || opp.TEN_NGUOI_CHOI || (existingPlayer && (existingPlayer.name || existingPlayer.TEN_NGUOI_CHOI)) || pId).trim();

    // Default missing/empty result to DRAW as per business rule #5
    let result = opp.result;
    if (!result || !String(result).trim()) {
      result = MATCH_RESULT.DRAW;
    } else {
      result = validateResult(result);
    }

    // Default missing bet to roundDefaultBet as per business rule #6
    let effectiveBet;
    if (opp.bet !== undefined && opp.bet !== null && opp.bet !== '') {
      effectiveBet = validateBet(Number(opp.bet), `Mức cược của người chơi ${pId}`);
    } else {
      effectiveBet = roundDefaultBet;
    }

    const delta = calculatePlayerDelta(result, effectiveBet);

    return {
      playerId: pId,
      name: pName,
      result: result,
      bet: effectiveBet,
      delta: delta
    };
  });

  const leaderPlayer = playerMap.get(leaderId);
  const leaderName = String(input.leaderName || (leaderPlayer && (leaderPlayer.name || leaderPlayer.TEN_NGUOI_CHOI)) || leaderId).trim();
  const leaderDelta = calculateLeaderDelta(normalizedDetails);
  const transactionTotal = calculateTransactionTotal(normalizedDetails);

  let note = String(input.note || input.GHI_CHU || '').trim();
  if (note.length > DEFAULTS.MAX_NOTE_LENGTH) {
    note = note.substring(0, DEFAULTS.MAX_NOTE_LENGTH);
  }

  const status = String(input.status || input.TRANG_THAI || ROUND_STATUS.HOP_LE).trim().toUpperCase();

  return {
    roundId: String(input.roundId || input.MA_VAN || '').trim(),
    roundNumber: Number(input.roundNumber || input.SO_VAN || 0),
    timestamp: input.timestamp || input.THOI_GIAN || new Date(),
    leaderId: leaderId,
    leaderName: leaderName,
    defaultBet: roundDefaultBet,
    details: normalizedDetails,
    leaderDelta: leaderDelta,
    transactionTotal: transactionTotal,
    note: note,
    status: status === ROUND_STATUS.DA_HUY ? ROUND_STATUS.DA_HUY : ROUND_STATUS.HOP_LE
  };
}

/**
 * Strictly validates a Round object against all business rules.
 * @param {Object} round - Round object
 * @param {Array<Object>} existingPlayers - List of all players in session
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRound(round, existingPlayers = []) {
  const errors = [];

  if (!round || typeof round !== 'object') {
    return { valid: false, errors: ['Đối tượng ván đấu không hợp lệ.'] };
  }

  const playerMap = new Map();
  if (Array.isArray(existingPlayers)) {
    for (const p of existingPlayers) {
      const id = String(p.playerId || p.MA_NGUOI_CHOI || '').trim();
      if (id) playerMap.set(id, p);
    }
  }

  // 1. Leader validation
  const leaderId = String(round.leaderId || '').trim();
  if (!leaderId) {
    errors.push('Chưa chọn người cầm đầu (A).');
  } else if (playerMap.size > 0) {
    const leader = playerMap.get(leaderId);
    if (!leader) {
      errors.push(`Người cầm đầu (${leaderId}) không tồn tại trong danh sách người chơi.`);
    } else {
      const status = String(leader.status || leader.TRANG_THAI || '').trim().toUpperCase();
      if (status !== PLAYER_STATUS.DANG_CHOI) {
        errors.push(`Người cầm đầu (${leaderId}) đang ở trạng thái ngừng chơi (${status}).`);
      }
    }
  }

  // 2. Opponents validation
  const details = round.details;
  if (!Array.isArray(details) || details.length === 0) {
    errors.push('Ván đấu phải có ít nhất 1 người đối đầu tham gia.');
  } else {
    const seenOpponentIds = new Set();

    for (let i = 0; i < details.length; i++) {
      const item = details[i];
      const pId = String(item.playerId || '').trim();

      if (!pId) {
        errors.push(`Người đối đầu ở vị trí ${i + 1} thiếu playerId.`);
        continue;
      }

      // Check duplicate opponent
      if (seenOpponentIds.has(pId)) {
        errors.push(`Người chơi đối đầu (${pId}) bị trùng lặp trong cùng một ván.`);
      }
      seenOpponentIds.add(pId);

      // Check leader in details
      if (pId === leaderId) {
        errors.push(`Người cầm đầu (${leaderId}) không được xuất hiện trong danh sách đối đầu.`);
      }

      // Check player existence and status
      if (playerMap.size > 0) {
        const player = playerMap.get(pId);
        if (!player) {
          errors.push(`Người đối đầu (${pId}) không tồn tại trong danh sách người chơi.`);
        } else {
          const status = String(player.status || player.TRANG_THAI || '').trim().toUpperCase();
          if (status !== PLAYER_STATUS.DANG_CHOI) {
            errors.push(`Người đối đầu (${pId}) đang ở trạng thái ngừng chơi (${status}).`);
          }
        }
      }

      // Check result
      try {
        validateResult(item.result);
      } catch (err) {
        errors.push(`Người đối đầu (${pId}): ${err.message}`);
      }

      // Check bet
      try {
        validateBet(item.bet, `Mức cược của người chơi ${pId}`);
      } catch (err) {
        errors.push(err.message);
      }
    }
  }

  // 3. Invariant check: leaderDelta + sum(opponentsDelta) === 0
  if (Array.isArray(details) && details.length > 0) {
    const sumOpponentsDelta = details.reduce((sum, d) => sum + (Number(d.delta) || 0), 0);
    const leaderDelta = Number(round.leaderDelta);
    if (leaderDelta + sumOpponentsDelta !== 0) {
      errors.push(
        `Vi phạm điều kiện bất biến điểm: leaderDelta (${leaderDelta}) + sum(opponentDelta) (${sumOpponentsDelta}) = ${
          leaderDelta + sumOpponentsDelta
        } !== 0.`
      );
    }
  }

  // 4. Note length check
  if (round.note && String(round.note).length > DEFAULTS.MAX_NOTE_LENGTH) {
    errors.push(`Ghi chú vượt quá ${DEFAULTS.MAX_NOTE_LENGTH} ký tự.`);
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validates session configuration.
 * @param {Object} config - Key-Value or Object configuration
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateConfig(config) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { valid: false, errors: ['Cấu hình phiên không hợp lệ.'] };
  }

  const sessionId = String(config.sessionId || config.MA_PHIEN || '').trim();
  if (!sessionId) {
    errors.push('Mã phiên (MA_PHIEN) không được để trống.');
  }

  const sessionName = String(config.sessionName || config.TEN_PHIEN || '').trim();
  if (!sessionName) {
    errors.push('Tên phiên (TEN_PHIEN) không được để trống.');
  }

  const defaultBet = config.defaultBet !== undefined ? config.defaultBet : config.CUOC_MAC_DINH;
  try {
    validateBet(Number(defaultBet), 'Mức cược mặc định');
  } catch (err) {
    errors.push(err.message);
  }

  const status = String(config.status || config.TRANG_THAI || SESSION_STATUS.DANG_CHOI).trim().toUpperCase();
  if (status !== SESSION_STATUS.DANG_CHOI && status !== SESSION_STATUS.DA_KET_THUC) {
    errors.push(`Trạng thái phiên không hợp lệ: ${status}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validates a player profile.
 * @param {Object} player - Player object
 * @param {Array<Object>} [existingPlayers=[]] - Current players list for duplicate checks
 * @param {boolean} [isNew=true] - Whether this is a newly added player
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validatePlayer(player, existingPlayers = [], isNew = true) {
  const errors = [];
  if (!player || typeof player !== 'object') {
    return { valid: false, errors: ['Thông tin người chơi không hợp lệ.'] };
  }

  const playerId = String(player.playerId || player.MA_NGUOI_CHOI || '').trim();
  if (!playerId) {
    errors.push('Mã người chơi (MA_NGUOI_CHOI) không được để trống.');
  } else if (isNew && Array.isArray(existingPlayers)) {
    const isDuplicate = existingPlayers.some(
      (p) => String(p.playerId || p.MA_NGUOI_CHOI || '').trim() === playerId
    );
    if (isDuplicate) {
      errors.push(`Mã người chơi '${playerId}' đã tồn tại trong phiên.`);
    }
  }

  const name = String(player.name || player.TEN_NGUOI_CHOI || '').trim();
  if (!name) {
    errors.push('Tên người chơi không được để trống.');
  } else if (name.length > 50) {
    errors.push('Tên người chơi tối đa 50 ký tự.');
  }

  const order = player.order !== undefined ? Number(player.order) : (player.THU_TU !== undefined ? Number(player.THU_TU) : 0);
  if (isNaN(order) || !Number.isInteger(order) || order < 0) {
    errors.push(`Thứ tự (THU_TU) phải là số nguyên không âm: ${order}`);
  }

  const status = String(player.status || player.TRANG_THAI || PLAYER_STATUS.DANG_CHOI).trim().toUpperCase();
  if (status !== PLAYER_STATUS.DANG_CHOI && status !== PLAYER_STATUS.NGUNG_CHOI) {
    errors.push(`Trạng thái người chơi không hợp lệ: ${status}`);
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validateBet,
    validateResult,
    normalizeRoundInput,
    validateRound,
    validateConfig,
    validatePlayer
  };
}
