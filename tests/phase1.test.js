/**
 * @fileoverview Test Suite for Phase 1 - Business Rules & Data Design
 * Executes all 20 required acceptance test cases + schema validation tests.
 */

const assert = require('assert');
const {
  SHEET_NAMES,
  CONFIG_KEYS,
  PLAYER_STATUS,
  MATCH_RESULT,
  ROUND_STATUS,
  HEADERS
} = require('../src/constants');
const {
  calculatePlayerDelta,
  calculateLeaderDelta,
  calculateTransactionTotal,
  calculateCompetitionRankings,
  rebuildSummary
} = require('../src/scoring');
const {
  validateBet,
  validateResult,
  normalizeRoundInput,
  validateRound,
  validateConfig,
  validatePlayer
} = require('../src/validation');
const {
  serializeRoundDetails,
  parseRoundDetails
} = require('../src/serializer');
const {
  validateSpreadsheetSchema,
  initializeSpreadsheetStructure
} = require('../src/schema');

// Lightweight test runner
let passCount = 0;
let failCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    failCount++;
  }
}

console.log('====================================================');
console.log('RUNNING PHASE 1 TEST SUITE: WEB APP "CHỐT ĐIỂM"');
console.log('====================================================\n');

// 1. TC-01: WIN với cược 5 trả về +5
runTest('TC-01: calculatePlayerDelta with WIN and bet=5 returns +5', () => {
  const delta = calculatePlayerDelta(MATCH_RESULT.WIN, 5);
  assert.strictEqual(delta, 5);
});

// 2. TC-02: LOSE với cược 5 trả về -5
runTest('TC-02: calculatePlayerDelta with LOSE and bet=5 returns -5', () => {
  const delta = calculatePlayerDelta(MATCH_RESULT.LOSE, 5);
  assert.strictEqual(delta, -5);
});

// 3. TC-03: DRAW với cược 5 trả về 0
runTest('TC-03: calculatePlayerDelta with DRAW and bet=5 returns 0', () => {
  const delta = calculatePlayerDelta(MATCH_RESULT.DRAW, 5);
  assert.strictEqual(delta, 0);
});

// 4. TC-04: Cược 0 trả về delta 0
runTest('TC-04: calculatePlayerDelta with bet=0 returns 0 for WIN, LOSE, DRAW', () => {
  assert.strictEqual(calculatePlayerDelta(MATCH_RESULT.WIN, 0), 0);
  assert.strictEqual(calculatePlayerDelta(MATCH_RESULT.LOSE, 0), 0);
  assert.strictEqual(calculatePlayerDelta(MATCH_RESULT.DRAW, 0), 0);
});

// 5. TC-05: Cược âm bị từ chối
runTest('TC-05: validateBet rejects negative numbers (-5)', () => {
  assert.throws(() => validateBet(-5), /không được là số âm/);
  assert.throws(() => calculatePlayerDelta(MATCH_RESULT.WIN, -5), /Invalid bet amount/);
});

// 6. TC-06: Cược thập phân bị từ chối
runTest('TC-06: validateBet rejects float numbers (5.5)', () => {
  assert.throws(() => validateBet(5.5), /phải là số nguyên/);
});

// 7. TC-07: Kết quả không hợp lệ bị từ chối
runTest('TC-07: validateResult rejects invalid match results', () => {
  assert.throws(() => validateResult('UNKNOWN'), /Kết quả không hợp lệ/);
  assert.throws(() => validateResult('INVALID_RESULT'), /Kết quả không hợp lệ/);
});

// 8. TC-08: Không có A bị từ chối
runTest('TC-08: normalizeRoundInput & validateRound reject round without leaderId', () => {
  assert.throws(() => normalizeRoundInput({ leaderId: '' }), /Chưa chọn người cầm đầu/);
  const result = validateRound({ leaderId: '', details: [] });
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('Chưa chọn người cầm đầu')));
});

// 9. TC-09: A xuất hiện trong details bị từ chối
runTest('TC-09: validateRound rejects leader appearing in opponents details', () => {
  const players = [
    { playerId: 'P001', name: 'An', status: PLAYER_STATUS.DANG_CHOI },
    { playerId: 'P002', name: 'Bình', status: PLAYER_STATUS.DANG_CHOI }
  ];
  const round = {
    leaderId: 'P001',
    details: [
      { playerId: 'P001', name: 'An', result: MATCH_RESULT.WIN, bet: 5, delta: 5 },
      { playerId: 'P002', name: 'Bình', result: MATCH_RESULT.LOSE, bet: 5, delta: -5 }
    ],
    leaderDelta: 0
  };
  const result = validateRound(round, players);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('không được xuất hiện trong danh sách đối đầu')));
});

// 10. TC-10: Hai detail trùng playerId bị từ chối
runTest('TC-10: validateRound rejects duplicate opponent playerId', () => {
  const players = [
    { playerId: 'P001', name: 'An', status: PLAYER_STATUS.DANG_CHOI },
    { playerId: 'P002', name: 'Bình', status: PLAYER_STATUS.DANG_CHOI }
  ];
  const round = {
    leaderId: 'P001',
    details: [
      { playerId: 'P002', name: 'Bình', result: MATCH_RESULT.WIN, bet: 5, delta: 5 },
      { playerId: 'P002', name: 'Bình 2', result: MATCH_RESULT.LOSE, bet: 5, delta: -5 }
    ],
    leaderDelta: 0
  };
  const result = validateRound(round, players);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('bị trùng lặp')));
});

// 11. TC-11: Người không có trong danh sách bị từ chối
runTest('TC-11: validateRound rejects opponent not found in player directory', () => {
  const players = [
    { playerId: 'P001', name: 'An', status: PLAYER_STATUS.DANG_CHOI }
  ];
  const round = {
    leaderId: 'P001',
    details: [
      { playerId: 'P999', name: 'Người Lạ', result: MATCH_RESULT.WIN, bet: 5, delta: 5 }
    ],
    leaderDelta: -5
  };
  const result = validateRound(round, players);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('không tồn tại trong danh sách')));
});

// 12. TC-12: Người ngừng chơi trong ván mới bị từ chối
runTest('TC-12: validateRound rejects opponent or leader with status NGUNG_CHOI', () => {
  const players = [
    { playerId: 'P001', name: 'An', status: PLAYER_STATUS.DANG_CHOI },
    { playerId: 'P002', name: 'Bình', status: PLAYER_STATUS.NGUNG_CHOI }
  ];
  const round = {
    leaderId: 'P001',
    details: [
      { playerId: 'P002', name: 'Bình', result: MATCH_RESULT.WIN, bet: 5, delta: 5 }
    ],
    leaderDelta: -5
  };
  const result = validateRound(round, players);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('trạng thái ngừng chơi')));
});

// 13. TC-13: Kết quả thiếu được chuẩn hóa thành DRAW
runTest('TC-13: normalizeRoundInput defaults missing result to DRAW', () => {
  const players = [
    { playerId: 'P001', name: 'An', status: PLAYER_STATUS.DANG_CHOI },
    { playerId: 'P002', name: 'Bình', status: PLAYER_STATUS.DANG_CHOI }
  ];
  const normalized = normalizeRoundInput(
    {
      leaderId: 'P001',
      details: [{ playerId: 'P002', name: 'Bình', bet: 10 }] // missing result
    },
    5,
    players
  );

  assert.strictEqual(normalized.details[0].result, MATCH_RESULT.DRAW);
  assert.strictEqual(normalized.details[0].delta, 0);
  assert.strictEqual(normalized.leaderDelta, 0);
});

// 14. TC-14: Cược riêng thiếu được thay bằng cược mặc định
runTest('TC-14: normalizeRoundInput defaults missing bet to session defaultBet', () => {
  const players = [
    { playerId: 'P001', name: 'An', status: PLAYER_STATUS.DANG_CHOI },
    { playerId: 'P002', name: 'Bình', status: PLAYER_STATUS.DANG_CHOI }
  ];
  const normalized = normalizeRoundInput(
    {
      leaderId: 'P001',
      details: [{ playerId: 'P002', name: 'Bình', result: MATCH_RESULT.WIN }] // missing bet
    },
    7, // session default bet = 7
    players
  );

  assert.strictEqual(normalized.details[0].bet, 7);
  assert.strictEqual(normalized.details[0].delta, 7);
  assert.strictEqual(normalized.leaderDelta, -7);
});

// 15. TC-15: Tổng delta toàn ván bằng 0
runTest('TC-15: Full round zero-sum invariant holds: leaderDelta + sum(opponentsDelta) === 0', () => {
  const details = [
    { playerId: 'P002', name: 'Bình', result: MATCH_RESULT.WIN, bet: 5, delta: 5 },
    { playerId: 'P003', name: 'Cường', result: MATCH_RESULT.LOSE, bet: 10, delta: -10 },
    { playerId: 'P004', name: 'Dũng', result: MATCH_RESULT.DRAW, bet: 5, delta: 0 }
  ];

  const leaderDelta = calculateLeaderDelta(details);
  assert.strictEqual(leaderDelta, 5);

  const sumOpponents = details.reduce((sum, d) => sum + d.delta, 0);
  assert.strictEqual(sumOpponents, -5);
  assert.strictEqual(leaderDelta + sumOpponents, 0);
});

// 16. TC-16: TONG_GIAO_DICH không đếm hai lần điểm của A
runTest('TC-16: calculateTransactionTotal computes sum(abs(opponentsDelta)) without doubling leader', () => {
  const details = [
    { playerId: 'P002', name: 'Bình', delta: 5 },
    { playerId: 'P003', name: 'Cường', delta: -10 },
    { playerId: 'P004', name: 'Dũng', delta: 0 }
  ];
  // sum(|5| + |-10| + |0|) = 15
  const total = calculateTransactionTotal(details);
  assert.strictEqual(total, 15);
});

// 17. TC-17: JSON hợp lệ serialize và parse thành công
runTest('TC-17: serializeRoundDetails and parseRoundDetails produce consistent data', () => {
  const original = [
    { playerId: 'P002', name: 'Bình', result: 'WIN', bet: 5, delta: 5 },
    { playerId: 'P003', name: 'Cường', result: 'LOSE', bet: 10, delta: -10 }
  ];

  const jsonStr = serializeRoundDetails(original);
  const parsed = parseRoundDetails(jsonStr);

  assert.strictEqual(parsed.success, true);
  assert.deepStrictEqual(parsed.data, original);
});

// 18. TC-18: JSON lỗi được xử lý an toàn
runTest('TC-18: parseRoundDetails handles malformed JSON safely without throwing', () => {
  const malformed = '{ invalid json string ...';
  const result = parseRoundDetails(malformed);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.data.length, 0);
  assert.ok(result.error);
});

// 19. TC-19: Ván DA_HUY không được tính tổng kết
runTest('TC-19: rebuildSummary excludes rounds with status DA_HUY', () => {
  const players = [
    { playerId: 'P001', name: 'An', status: PLAYER_STATUS.DANG_CHOI },
    { playerId: 'P002', name: 'Bình', status: PLAYER_STATUS.DANG_CHOI }
  ];

  const rounds = [
    {
      roundId: 'V000001',
      status: ROUND_STATUS.HOP_LE,
      leaderId: 'P001',
      leaderDelta: -10,
      details: [{ playerId: 'P002', result: MATCH_RESULT.WIN, bet: 10, delta: 10 }]
    },
    {
      roundId: 'V000002',
      status: ROUND_STATUS.DA_HUY, // Cancelled round
      leaderId: 'P001',
      leaderDelta: 1000,
      details: [{ playerId: 'P002', result: MATCH_RESULT.LOSE, bet: 1000, delta: -1000 }]
    }
  ];

  const summary = rebuildSummary(players, rounds);
  const p1 = summary.find((s) => s.playerId === 'P001');
  const p2 = summary.find((s) => s.playerId === 'P002');

  assert.strictEqual(p1.roundsPlayed, 1);
  assert.strictEqual(p1.totalScore, -10);
  assert.strictEqual(p2.roundsPlayed, 1);
  assert.strictEqual(p2.totalScore, 10);
});

// 20. TC-20: Xếp hạng đồng điểm theo 1, 2, 2, 4
runTest('TC-20: calculateCompetitionRankings applies 1, 2, 2, 4 ranking format', () => {
  const rawList = [
    { playerId: 'P001', name: 'An', totalScore: 10, roundsPlayed: 2 },
    { playerId: 'P002', name: 'Bình', totalScore: 20, roundsPlayed: 2 },
    { playerId: 'P003', name: 'Cường', totalScore: 10, roundsPlayed: 3 }, // Same score as An, played more rounds
    { playerId: 'P004', name: 'Dũng', totalScore: -5, roundsPlayed: 2 }
  ];

  const ranked = calculateCompetitionRankings(rawList);

  // Expected order: Bình (20 -> Rank 1), Cường (10, 3 rounds -> Rank 2), An (10, 2 rounds -> Rank 2), Dũng (-5 -> Rank 4)
  assert.strictEqual(ranked[0].playerId, 'P002');
  assert.strictEqual(ranked[0].rank, 1);

  assert.strictEqual(ranked[1].playerId, 'P003');
  assert.strictEqual(ranked[1].rank, 2);

  assert.strictEqual(ranked[2].playerId, 'P001');
  assert.strictEqual(ranked[2].rank, 2);

  assert.strictEqual(ranked[3].playerId, 'P004');
  assert.strictEqual(ranked[3].rank, 4);
});

// Extra: Spreadsheet structure initialization and schema validation mock test
runTest('EXTRA: Mock Spreadsheet initialization and validation', () => {
  const mockSheets = new Map();

  const mockSpreadsheet = {
    getSheetByName: (name) => mockSheets.get(name) || null,
    insertSheet: (name) => {
      const sheetData = {
        name,
        values: [],
        headers: [],
        getRange: (r, c, numR, numC) => ({
          setValues: (vals) => {
            if (r === 1) sheetData.headers = vals[0];
            sheetData.values.push(...vals);
          },
          getValues: () => [sheetData.headers]
        }),
        getLastColumn: () => sheetData.headers.length
      };
      mockSheets.set(name, sheetData);
      return sheetData;
    }
  };

  const initResult = initializeSpreadsheetStructure(mockSpreadsheet, {
    appName: 'Chốt Điểm',
    sessionId: 'CP-TEST-001',
    sessionName: 'Test Session',
    defaultBet: 5
  });

  assert.strictEqual(initResult.success, true);
  assert.strictEqual(initResult.createdSheets.length, 4);

  const validationResult = validateSpreadsheetSchema(mockSpreadsheet);
  assert.strictEqual(validationResult.valid, true);
  assert.strictEqual(validationResult.errors.length, 0);
});

console.log('\n====================================================');
console.log(`TEST RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
console.log('====================================================');

if (failCount > 0) {
  process.exit(1);
}
