/**
 * @fileoverview Config.gs - Configuration, Constants and Enums for Web App "Chốt Điểm"
 * Google Apps Script V8 Runtime
 */

const CONFIG = {
  SHEET_NAMES: {
    CAU_HINH: 'CAU_HINH',
    NGUOI_CHOI: 'NGUOI_CHOI',
    VAN_DAU: 'VAN_DAU',
    TONG_KET: 'TONG_KET'
  },

  CONFIG_KEYS: {
    TEN_APP: 'TEN_APP',
    MA_PHIEN: 'MA_PHIEN',
    TEN_PHIEN: 'TEN_PHIEN',
    CUOC_MAC_DINH: 'CUOC_MAC_DINH',
    THOI_GIAN_TAO: 'THOI_GIAN_TAO',
    TRANG_THAI: 'TRANG_THAI',
    TIMEZONE: 'TIMEZONE',
    SCHEMA_VERSION: 'SCHEMA_VERSION'
  },

  HEADERS: {
    CAU_HINH: ['KHOA', 'GIA_TRI'],
    NGUOI_CHOI: [
      'MA_NGUOI_CHOI',
      'TEN_NGUOI_CHOI',
      'THU_TU',
      'TRANG_THAI',
      'THOI_GIAN_THEM'
    ],
    VAN_DAU: [
      'MA_VAN',
      'SO_VAN',
      'THOI_GIAN',
      'MA_NGUOI_CAM_DAU',
      'TEN_NGUOI_CAM_DAU',
      'CUOC_MAC_DINH',
      'CHI_TIET_JSON',
      'DIEM_CAM_DAU',
      'TONG_GIAO_DICH',
      'GHI_CHU',
      'TRANG_THAI'
    ],
    TONG_KET: [
      'MA_NGUOI_CHOI',
      'TEN_NGUOI_CHOI',
      'SO_VAN_THAM_GIA',
      'SO_LAN_CAM_DAU',
      'SO_LAN_THANG',
      'SO_LAN_HOA',
      'SO_LAN_THUA',
      'TONG_DIEM',
      'XEP_HANG'
    ]
  },

  SESSION_STATUS: {
    DANG_CHOI: 'DANG_CHOI',
    DA_KET_THUC: 'DA_KET_THUC'
  },

  PLAYER_STATUS: {
    DANG_CHOI: 'DANG_CHOI',
    NGUNG_CHOI: 'NGUNG_CHOI'
  },

  MATCH_RESULT: {
    WIN: 'WIN',
    DRAW: 'DRAW',
    LOSE: 'LOSE'
  },

  ROUND_STATUS: {
    HOP_LE: 'HOP_LE',
    DA_HUY: 'DA_HUY'
  },

  ERROR_CODES: {
    INVALID_ARGUMENT: 'INVALID_ARGUMENT',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_PLAYER: 'DUPLICATE_PLAYER',
    INVALID_PLAYER: 'INVALID_PLAYER',
    INACTIVE_PLAYER: 'INACTIVE_PLAYER',
    INVALID_LEADER: 'INVALID_LEADER',
    INVALID_OPPONENT: 'INVALID_OPPONENT',
    DUPLICATE_OPPONENT: 'DUPLICATE_OPPONENT',
    INVALID_RESULT: 'INVALID_RESULT',
    INVALID_BET: 'INVALID_BET',
    ZERO_SUM_FAILED: 'ZERO_SUM_FAILED',
    GAME_CANCELLED: 'GAME_CANCELLED',
    INVALID_GAME_DATA: 'INVALID_GAME_DATA',
    SHEET_NOT_INITIALIZED: 'SHEET_NOT_INITIALIZED',
    LOCK_TIMEOUT: 'LOCK_TIMEOUT',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
  },

  DEFAULTS: {
    APP_NAME: 'Chốt Điểm',
    DEFAULT_BET: 5,
    TIMEZONE: 'Asia/Ho_Chi_Minh',
    SCHEMA_VERSION: '1.0.0',
    MAX_NOTE_LENGTH: 500,
    MAX_PLAYER_NAME_LENGTH: 50,
    LOCK_TIMEOUT_MS: 10000 // 10 seconds timeout for LockService
  }
};

// Freeze configuration object to prevent runtime mutations
Object.freeze(CONFIG);
Object.freeze(CONFIG.SHEET_NAMES);
Object.freeze(CONFIG.CONFIG_KEYS);
Object.freeze(CONFIG.HEADERS);
Object.freeze(CONFIG.SESSION_STATUS);
Object.freeze(CONFIG.PLAYER_STATUS);
Object.freeze(CONFIG.MATCH_RESULT);
Object.freeze(CONFIG.ROUND_STATUS);
Object.freeze(CONFIG.ERROR_CODES);
Object.freeze(CONFIG.DEFAULTS);

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
