/**
 * @fileoverview Pure scoring functions and ranking logic for Web App "Chốt Điểm" (Phase 1)
 */

const { MATCH_RESULT, ROUND_STATUS } = typeof require !== 'undefined'
  ? require('./constants')
  : { MATCH_RESULT: { WIN: 'WIN', DRAW: 'DRAW', LOSE: 'LOSE' }, ROUND_STATUS: { HOP_LE: 'HOP_LE', DA_HUY: 'DA_HUY' } };

/**
 * Calculates point delta for a single opponent player based on match result and bet.
 * @param {'WIN' | 'DRAW' | 'LOSE'} result - Result against leader A
 * @param {number} bet - Effective bet amount (non-negative integer)
 * @returns {number} Score delta (+bet, -bet, or 0)
 */
function calculatePlayerDelta(result, bet) {
  if (typeof bet !== 'number' || isNaN(bet) || !isFinite(bet) || bet < 0) {
    throw new Error(`Invalid bet amount: ${bet}. Bet must be a non-negative finite number.`);
  }

  const normalizedResult = String(result || '').trim().toUpperCase();

  switch (normalizedResult) {
    case MATCH_RESULT.WIN:
      return bet;
    case MATCH_RESULT.LOSE:
      return bet === 0 ? 0 : -bet;
    case MATCH_RESULT.DRAW:
      return 0;
    default:
      throw new Error(`Invalid match result: '${result}'. Expected WIN, DRAW, or LOSE.`);
  }
}

/**
 * Calculates delta for the leader A. Leader delta is the negative sum of all opponents' deltas.
 * Invariant: leaderDelta + sum(opponentDelta) === 0
 * @param {Array<{ delta: number }>} details - Array of opponent details containing deltas
 * @returns {number} Leader delta
 */
function calculateLeaderDelta(details) {
  if (!Array.isArray(details)) {
    throw new TypeError('Details must be an array');
  }

  const opponentsDeltaSum = details.reduce((sum, item) => {
    const d = Number(item.delta);
    if (isNaN(d) || !isFinite(d)) {
      throw new Error(`Invalid opponent delta: ${item.delta}`);
    }
    return sum + d;
  }, 0);

  return opponentsDeltaSum === 0 ? 0 : -opponentsDeltaSum;
}

/**
 * Calculates total transactions in a round.
 * Formula: sum(abs(opponentDelta))
 * Note: Does not add leaderDelta to prevent double-counting.
 * @param {Array<{ delta: number }>} details - Array of opponent details
 * @returns {number} Total transactions volume
 */
function calculateTransactionTotal(details) {
  if (!Array.isArray(details)) {
    throw new TypeError('Details must be an array');
  }

  return details.reduce((sum, item) => {
    const d = Number(item.delta);
    if (isNaN(d) || !isFinite(d)) {
      throw new Error(`Invalid opponent delta for transaction total: ${item.delta}`);
    }
    return sum + Math.abs(d);
  }, 0);
}

/**
 * Applies Competition Ranking ("1, 2, 2, 4" rule) to an array of player summary objects.
 * Ties receive the same rank; the next distinct score gets rank = current_position + 1.
 * Tie-breakers for display sorting (does not change rank):
 * 1. roundsPlayed DESC
 * 2. playerName ASC (locale-sensitive)
 * 3. playerId ASC
 * @param {Array<Object>} summaryList - Array of calculated summary rows
 * @returns {Array<Object>} Sorted summary rows with rank assigned
 */
function calculateCompetitionRankings(summaryList) {
  if (!Array.isArray(summaryList)) return [];

  // Sort by totalScore DESC, then secondary display criteria
  const sorted = [...summaryList].sort((a, b) => {
    if (b.totalScore !== a.totalScore) {
      return b.totalScore - a.totalScore;
    }
    if (b.roundsPlayed !== a.roundsPlayed) {
      return b.roundsPlayed - a.roundsPlayed;
    }
    const nameCompare = String(a.name || '').localeCompare(String(b.name || ''), 'vi');
    if (nameCompare !== 0) {
      return nameCompare;
    }
    return String(a.playerId || '').localeCompare(String(b.playerId || ''));
  });

  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i].totalScore === sorted[i - 1].totalScore) {
      // Same score -> same rank as previous
      sorted[i].rank = sorted[i - 1].rank;
    } else {
      // Different score -> rank equals 1-based index (Competition ranking)
      sorted[i].rank = i + 1;
    }
  }

  return sorted;
}

/**
 * Rebuilds the complete Summary dataset from raw Players and Rounds.
 * Pure function: Does not directly modify sheets, can be used anywhere.
 * @param {Array<Object>} players - List of all players (including active and inactive)
 * @param {Array<Object>} rounds - List of all rounds in the session
 * @returns {Array<Object>} Final summary table with stats and rankings
 */
function rebuildSummary(players, rounds) {
  if (!Array.isArray(players)) return [];

  // Initialize summary map with all players
  const summaryMap = new Map();

  for (const player of players) {
    const id = String(player.playerId || player.MA_NGUOI_CHOI || '').trim();
    if (!id) continue;

    const name = String(player.name || player.TEN_NGUOI_CHOI || id).trim();

    summaryMap.set(id, {
      playerId: id,
      name: name,
      roundsPlayed: 0,
      leaderCount: 0,
      winCount: 0,
      drawCount: 0,
      loseCount: 0,
      totalScore: 0,
      rank: 0
    });
  }

  if (Array.isArray(rounds)) {
    for (const round of rounds) {
      const status = String(round.status || round.TRANG_THAI || '').trim().toUpperCase();
      // Only valid rounds are calculated
      if (status !== ROUND_STATUS.HOP_LE) {
        continue;
      }

      const leaderId = String(round.leaderId || round.MA_NGUOI_CAM_DAU || '').trim();
      const leaderDelta = Number(round.leaderDelta !== undefined ? round.leaderDelta : round.DIEM_CAM_DAU);

      // Process Leader A
      if (leaderId && summaryMap.has(leaderId)) {
        const leaderSummary = summaryMap.get(leaderId);
        leaderSummary.roundsPlayed += 1;
        leaderSummary.leaderCount += 1;
        leaderSummary.totalScore += (isNaN(leaderDelta) ? 0 : leaderDelta);
      }

      // Process Opponents
      let details = round.details;
      if (!details && (round.CHI_TIET_JSON || typeof round.CHI_TIET_JSON === 'string')) {
        try {
          details = JSON.parse(round.CHI_TIET_JSON);
        } catch {
          // Corrupt JSON in single round is ignored from calculation
          continue;
        }
      }

      if (Array.isArray(details)) {
        for (const detail of details) {
          const oppId = String(detail.playerId || '').trim();
          if (!oppId || !summaryMap.has(oppId)) continue;

          const oppSummary = summaryMap.get(oppId);
          oppSummary.roundsPlayed += 1;

          const res = String(detail.result || '').trim().toUpperCase();
          if (res === MATCH_RESULT.WIN) {
            oppSummary.winCount += 1;
          } else if (res === MATCH_RESULT.DRAW) {
            oppSummary.drawCount += 1;
          } else if (res === MATCH_RESULT.LOSE) {
            oppSummary.loseCount += 1;
          }

          const delta = Number(detail.delta);
          oppSummary.totalScore += (isNaN(delta) ? 0 : delta);
        }
      }
    }
  }

  const rawList = Array.from(summaryMap.values());
  return calculateCompetitionRankings(rawList);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculatePlayerDelta,
    calculateLeaderDelta,
    calculateTransactionTotal,
    calculateCompetitionRankings,
    rebuildSummary
  };
}
