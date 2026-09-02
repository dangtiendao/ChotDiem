/**
 * @fileoverview Serialization & Deserialization module for Round Details (Phase 1)
 */

/**
 * Serializes an array of RoundDetail objects into a normalized JSON string.
 * @param {Array<Object>} details - List of round details
 * @returns {string} JSON string to be stored in the single cell of Google Sheets
 */
function serializeRoundDetails(details) {
  if (!Array.isArray(details)) {
    throw new TypeError('Round details must be an array');
  }

  const normalized = details.map((d) => ({
    playerId: String(d.playerId || '').trim(),
    name: String(d.name || '').trim(),
    result: String(d.result || '').trim().toUpperCase(),
    bet: Number(d.bet),
    delta: Number(d.delta)
  }));

  return JSON.stringify(normalized);
}

/**
 * Safely parses a JSON string containing round details.
 * @param {string} jsonString - The raw string read from Google Sheets
 * @returns {{ success: boolean, data: Array<Object>, error?: string }}
 */
function parseRoundDetails(jsonString) {
  if (typeof jsonString !== 'string' || !jsonString.trim()) {
    return {
      success: false,
      data: [],
      error: 'Empty or non-string JSON content'
    };
  }

  try {
    const parsed = JSON.parse(jsonString);
    if (!Array.isArray(parsed)) {
      return {
        success: false,
        data: [],
        error: 'JSON root must be an array'
      };
    }

    const validatedData = parsed.map((item) => ({
      playerId: String(item.playerId || ''),
      name: String(item.name || ''),
      result: String(item.result || '').toUpperCase(),
      bet: Number(item.bet),
      delta: Number(item.delta)
    }));

    return {
      success: true,
      data: validatedData
    };
  } catch (err) {
    return {
      success: false,
      data: [],
      error: `JSON parse error: ${err.message}`
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    serializeRoundDetails,
    parseRoundDetails
  };
}
