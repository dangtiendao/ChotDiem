/**
 * @fileoverview SummaryService.gs - Summary, Scoreboard and Ranking Computation
 * Google Apps Script V8 Runtime
 */

const _CFG_SUM = typeof CONFIG !== 'undefined' ? CONFIG : (typeof require !== 'undefined' ? require('./Config.gs') : {});
const _UTILS_SUM = typeof responseOk !== 'undefined'
  ? { responseOk, responseError, getActiveSpreadsheet, getHeaderMap, safeJsonParse }
  : (typeof require !== 'undefined' ? require('./Utils.gs') : {});

/**
 * Computes the dynamic scoreboard / ranking table for all players in the session.
 * Excludes cancelled rounds (DA_HUY) and handles malformed JSON safely.
 *
 * @param {string} [sessionId] - Optional session ID
 * @returns {{ ok: boolean, data?: Array<Object>, error?: Object, message?: string }}
 */
function getScoreboard(sessionId) {
  try {
    const ss = _UTILS_SUM.getActiveSpreadsheet();
    const playerSheet = ss.getSheetByName(_CFG_SUM.SHEET_NAMES.NGUOI_CHOI);
    const roundSheet = ss.getSheetByName(_CFG_SUM.SHEET_NAMES.VAN_DAU);

    if (!playerSheet || !roundSheet) {
      return _UTILS_SUM.responseError(
        _CFG_SUM.ERROR_CODES.SHEET_NOT_INITIALIZED,
        'Các sheet dữ liệu chưa được khởi tạo. Vui lòng chạy setupApp().'
      );
    }

    // 1. Read all players (including active & inactive)
    const playerMap = new Map();
    const playerLastRow = playerSheet.getLastRow();

    if (playerLastRow > 1) {
      const playerHeaderMap = _UTILS_SUM.getHeaderMap(playerSheet);
      const playerLastCol = playerSheet.getLastColumn();
      const playerValues = playerSheet.getRange(2, 1, playerLastRow - 1, playerLastCol).getValues();

      const colPId = playerHeaderMap.MA_NGUOI_CHOI - 1;
      const colPName = playerHeaderMap.TEN_NGUOI_CHOI - 1;
      const colPOrder = playerHeaderMap.THU_TU - 1;
      const colPStatus = playerHeaderMap.TRANG_THAI - 1;

      for (let i = 0; i < playerValues.length; i++) {
        const row = playerValues[i];
        const pId = String(row[colPId] || '').trim();
        if (!pId) continue;

        const status = String(row[colPStatus] || _CFG_SUM.PLAYER_STATUS.DANG_CHOI).trim().toUpperCase();
        const orderVal = parseInt(row[colPOrder], 10);

        playerMap.set(pId, {
          playerId: pId,
          name: String(row[colPName] || pId).trim(),
          order: isNaN(orderVal) ? i + 1 : orderVal,
          status: status,
          active: status === _CFG_SUM.PLAYER_STATUS.DANG_CHOI,
          gamesPlayed: 0,
          leaderCount: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          totalScore: 0,
          rank: 0
        });
      }
    }

    // 2. Read all valid rounds from VAN_DAU
    const roundLastRow = roundSheet.getLastRow();

    if (roundLastRow > 1) {
      const roundHeaderMap = _UTILS_SUM.getHeaderMap(roundSheet);
      const roundLastCol = roundSheet.getLastColumn();
      const roundValues = roundSheet.getRange(2, 1, roundLastRow - 1, roundLastCol).getValues();

      const colStatus = roundHeaderMap.TRANG_THAI - 1;
      const colLeaderId = roundHeaderMap.MA_NGUOI_CAM_DAU - 1;
      const colLeaderDelta = roundHeaderMap.DIEM_CAM_DAU - 1;
      const colJson = roundHeaderMap.CHI_TIET_JSON - 1;
      const colGameId = roundHeaderMap.MA_VAN - 1;

      for (let r = 0; r < roundValues.length; r++) {
        const row = roundValues[r];
        const roundStatus = String(row[colStatus] || '').trim().toUpperCase();

        // Strictly ignore cancelled rounds
        if (roundStatus === _CFG_SUM.ROUND_STATUS.DA_HUY) {
          continue;
        }

        const gameId = String(row[colGameId] || `Row_${r + 2}`);
        const leaderId = String(row[colLeaderId] || '').trim();
        const leaderDelta = Number(row[colLeaderDelta]);

        // Process Leader stats
        if (leaderId && playerMap.has(leaderId)) {
          const leaderStats = playerMap.get(leaderId);
          leaderStats.gamesPlayed += 1;
          leaderStats.leaderCount += 1;
          leaderStats.totalScore += (isNaN(leaderDelta) ? 0 : leaderDelta);
        }

        // Process Opponents from JSON
        const rawJson = String(row[colJson] || '');
        const details = _UTILS_SUM.safeJsonParse(rawJson, null);

        if (!Array.isArray(details)) {
          console.warn(`[getScoreboard] Malformed JSON at game '${gameId}' (Row ${r + 2}):`, rawJson);
          continue; // Safely skip corrupt line without crashing
        }

        for (const detail of details) {
          const oppId = String(detail.playerId || '').trim();
          if (!oppId || !playerMap.has(oppId)) continue;

          const oppStats = playerMap.get(oppId);
          oppStats.gamesPlayed += 1;

          const res = String(detail.result || '').trim().toUpperCase();
          if (res === _CFG_SUM.MATCH_RESULT.WIN) {
            oppStats.wins += 1;
          } else if (res === _CFG_SUM.MATCH_RESULT.DRAW) {
            oppStats.draws += 1;
          } else if (res === _CFG_SUM.MATCH_RESULT.LOSE) {
            oppStats.losses += 1;
          }

          const delta = Number(detail.delta);
          oppStats.totalScore += (isNaN(delta) ? 0 : delta);
        }
      }
    }

    // 3. Sort players according to competition ranking and tie-breakers
    const summaryList = Array.from(playerMap.values());

    summaryList.sort((a, b) => {
      // Primary: totalScore DESC
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      // Tie-breaker 1: gamesPlayed DESC
      if (b.gamesPlayed !== a.gamesPlayed) {
        return b.gamesPlayed - a.gamesPlayed;
      }
      // Tie-breaker 2: wins DESC
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      // Tie-breaker 3: losses ASC
      if (a.losses !== b.losses) {
        return a.losses - b.losses;
      }
      // Tie-breaker 4: display order ASC
      if (a.order !== b.order) {
        return a.order - b.order;
      }
      // Tie-breaker 5: name ASC (locale-aware)
      const nameComp = a.name.localeCompare(b.name, 'vi');
      if (nameComp !== 0) {
        return nameComp;
      }
      // Tie-breaker 6: playerId ASC
      return a.playerId.localeCompare(b.playerId);
    });

    // 4. Assign Competition Ranking ("1, 2, 2, 4" rule)
    for (let i = 0; i < summaryList.length; i++) {
      if (i > 0 && summaryList[i].totalScore === summaryList[i - 1].totalScore) {
        summaryList[i].rank = summaryList[i - 1].rank;
      } else {
        summaryList[i].rank = i + 1;
      }
    }

    return _UTILS_SUM.responseOk(summaryList, 'Lấy bảng tổng kết thành công.');
  } catch (err) {
    console.error('[getScoreboard] Error:', err);
    return _UTILS_SUM.responseError(_CFG_SUM.ERROR_CODES.INTERNAL_ERROR, err.message);
  }
}

/**
 * Rebuilds the physical TONG_KET sheet using latest computed scoreboard.
 * Purely derived cache table - can be rebuilt at any time.
 *
 * @returns {{ ok: boolean, data?: any, error?: Object, message?: string }}
 */
function rebuildSummarySheet() {
  try {
    const scoreboardRes = getScoreboard();
    if (!scoreboardRes.ok) return scoreboardRes;

    const ss = _UTILS_SUM.getActiveSpreadsheet();
    let summarySheet = ss.getSheetByName(_CFG_SUM.SHEET_NAMES.TONG_KET);

    if (!summarySheet) {
      summarySheet = ss.insertSheet(_CFG_SUM.SHEET_NAMES.TONG_KET);
    }

    const expectedHeaders = _CFG_SUM.HEADERS.TONG_KET;
    const scoreboard = scoreboardRes.data || [];

    // Clear existing contents in TONG_KET
    summarySheet.clearContents();

    // Write header
    summarySheet.getRange(1, 1, 1, expectedHeaders.length).setValues([expectedHeaders]);

    if (scoreboard.length > 0) {
      const rows = scoreboard.map((item) => [
        item.playerId,
        item.name,
        item.gamesPlayed,
        item.leaderCount,
        item.wins,
        item.draws,
        item.losses,
        item.totalScore,
        item.rank
      ]);

      summarySheet.getRange(2, 1, rows.length, expectedHeaders.length).setValues(rows);
    }

    return _UTILS_SUM.responseOk({ rowCount: scoreboard.length }, 'Đã tái tạo sheet TONG_KET thành công.');
  } catch (err) {
    console.error('[rebuildSummarySheet] Error:', err);
    return _UTILS_SUM.responseError(_CFG_SUM.ERROR_CODES.INTERNAL_ERROR, err.message);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getScoreboard,
    rebuildSummarySheet
  };
}
