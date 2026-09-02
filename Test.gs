/**
 * @fileoverview Test.gs - Automated and Manual Test Suite for Google Apps Script Environment
 * Run these functions directly from Apps Script Console (Run > runPhase2Tests).
 */

/**
 * Runs the entire test suite directly in Google Apps Script console.
 * Logs detailed test execution results.
 */
function runPhase2Tests() {
  console.log('====================================================');
  console.log('STARTING PHASE 2 APPS SCRIPT BACKEND TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assertTest(name, condition, errorMsg) {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} - ${errorMsg || 'Assertion failed'}`);
      failed++;
    }
  }

  // 1. Test pure scoring calculations
  console.log('--- 1. Testing Scoring Calculations ---');
  try {
    assertTest('calculatePlayerDelta WIN (bet=5)', calculatePlayerDelta('WIN', 5) === 5);
    assertTest('calculatePlayerDelta LOSE (bet=5)', calculatePlayerDelta('LOSE', 5) === -5);
    assertTest('calculatePlayerDelta DRAW (bet=5)', calculatePlayerDelta('DRAW', 5) === 0);
    assertTest('calculatePlayerDelta bet=0', calculatePlayerDelta('WIN', 0) === 0 && calculatePlayerDelta('LOSE', 0) === 0);

    const testDetails = [
      { playerId: 'P002', delta: 5 },
      { playerId: 'P003', delta: -10 },
      { playerId: 'P004', delta: 0 }
    ];
    assertTest('calculateLeaderDelta (-sum)', calculateLeaderDelta(testDetails) === 5);
    assertTest('calculateTransactionTotal (sum abs)', calculateTransactionTotal(testDetails) === 15);
    assertTest('Zero-sum invariant', calculateLeaderDelta(testDetails) + testDetails.reduce((s, d) => s + d.delta, 0) === 0);
  } catch (e) {
    console.error('Error in scoring tests:', e);
    failed++;
  }

  // 2. Test setupApp() idempotency and sheet creation
  console.log('\n--- 2. Testing setupApp() ---');
  try {
    const setupRes1 = setupApp({ sessionName: 'Test Session Phase 2' });
    assertTest('setupApp first run success', setupRes1.ok === true);

    const setupRes2 = setupApp();
    assertTest('setupApp second run is idempotent', setupRes2.ok === true);

    const statusRes = getAppStatus();
    assertTest('getAppStatus returns active state', statusRes.ok === true && statusRes.data.appName === 'Chốt Điểm');
  } catch (e) {
    console.error('Error in setupApp tests:', e);
    failed++;
  }

  // 3. Test PlayerService
  console.log('\n--- 3. Testing PlayerService ---');
  try {
    const p1Res = addPlayer('Người Chơi Test 1');
    assertTest('addPlayer P1', p1Res.ok === true && p1Res.data.playerId.startsWith('P'));

    const p2Res = addPlayer('Người Chơi Test 2');
    assertTest('addPlayer P2', p2Res.ok === true);

    const dupRes = addPlayer('người chơi test 1'); // Case insensitive duplicate check
    assertTest('addPlayer duplicate rejected', dupRes.ok === false && dupRes.error.code === 'DUPLICATE_PLAYER');

    const emptyRes = addPlayer('   ');
    assertTest('addPlayer empty name rejected', emptyRes.ok === false);

    const p1Id = p1Res.data ? p1Res.data.playerId : 'P001';
    const p2Id = p2Res.data ? p2Res.data.playerId : 'P002';

    const updateRes = updatePlayer(p1Id, { name: 'Người Chơi Test 1 (Đã Đổi Tên)' });
    assertTest('updatePlayer name', updateRes.ok === true && updateRes.data.name.includes('(Đã Đổi Tên)'));

    const reorderRes = reorderPlayers([p2Id, p1Id]);
    assertTest('reorderPlayers', reorderRes.ok === true);
  } catch (e) {
    console.error('Error in PlayerService tests:', e);
    failed++;
  }

  // 4. Test GameService & Scoreboard
  console.log('\n--- 4. Testing GameService & Scoreboard ---');
  try {
    const playersList = getPlayers(false).data || [];
    if (playersList.length >= 2) {
      const leaderId = playersList[0].playerId;
      const oppId = playersList[1].playerId;

      const saveRes = saveGame({
        leaderId: leaderId,
        defaultBet: 5,
        opponents: [
          { playerId: oppId, result: 'WIN', bet: 10 }
        ],
        note: 'Test Round 1'
      });

      assertTest('saveGame creates 1 round with correct deltas', saveRes.ok === true && saveRes.data.game.leaderDelta === -10);
      assertTest('saveGame returns scoreboard', Array.isArray(saveRes.data.scoreboard));

      const gameId = saveRes.data.game.gameId;

      // Test cancelGame (soft delete)
      const cancelRes = cancelGame(gameId);
      assertTest('cancelGame sets status DA_HUY', cancelRes.ok === true && cancelRes.data.game.status === 'DA_HUY');

      // Test restoreGame
      const restoreRes = restoreGame(gameId);
      assertTest('restoreGame sets status HOP_LE', restoreRes.ok === true && restoreRes.data.game.status === 'HOP_LE');

      // Test updateGame
      const updateGameRes = updateGame(gameId, {
        leaderId: leaderId,
        opponents: [
          { playerId: oppId, result: 'LOSE', bet: 10 }
        ],
        note: 'Test Round 1 (Updated to LOSE)'
      });
      assertTest('updateGame updates in place', updateGameRes.ok === true && updateGameRes.data.game.leaderDelta === 10);
    } else {
      console.warn('Skipping GameService live tests: need at least 2 players.');
    }
  } catch (e) {
    console.error('Error in GameService tests:', e);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  return { passed, failed, success: failed === 0 };
}
