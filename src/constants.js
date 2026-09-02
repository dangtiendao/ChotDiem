/**
 * @fileoverview Constants and enumerations for Web App "Chốt Điểm" (Phase 1)
 * Compatible with both Google Apps Script and Node.js environments.
 */

const SHEET_NAMES = Object.freeze({
  CAU_HINH: 'CAU_HINH',
  NGUOI_CHOI: 'NGUOI_CHOI',
  VAN_DAU: 'VAN_DAU',
  TONG_KET: 'TONG_KET'
});

const CONFIG_KEYS = Object.freeze({
  TEN_APP: 'TEN_APP',
  MA_PHIEN: 'MA_PHIEN',
  TEN_PHIEN: 'TEN_PHIEN',
  CUOC_MAC_DINH: 'CUOC_MAC_DINH',
  THOI_GIAN_TAO: 'THOI_GIAN_TAO',
  TRANG_THAI: 'TRANG_THAI',
  TIMEZONE: 'TIMEZONE',
  SCHEMA_VERSION: 'SCHEMA_VERSION'
});

const SESSION_STATUS = Object.freeze({
  DANG_CHOI: 'DANG_CHOI',
  DA_KET_THUC: 'DA_KET_THUC'
});

const PLAYER_STATUS = Object.freeze({
  DANG_CHOI: 'DANG_CHOI',
  NGUNG_CHOI: 'NGUNG_CHOI'
});

const MATCH_RESULT = Object.freeze({
  WIN: 'WIN',
  DRAW: 'DRAW',
  LOSE: 'LOSE'
});

const ROUND_STATUS = Object.freeze({
  HOP_LE: 'HOP_LE',
  DA_HUY: 'DA_HUY'
});

const HEADERS = Object.freeze({
  CAU_HINH: Object.freeze(['KHOA', 'GIA_TRI']),
  NGUOI_CHOI: Object.freeze([
    'MA_NGUOI_CHOI',
    'TEN_NGUOI_CHOI',
    'THU_TU',
    'TRANG_THAI',
    'THOI_GIAN_THEM'
  ]),
  VAN_DAU: Object.freeze([
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
  ]),
  TONG_KET: Object.freeze([
    'MA_NGUOI_CHOI',
    'TEN_NGUOI_CHOI',
    'SO_VAN_THAM_GIA',
    'SO_LAN_CAM_DAU',
    'SO_LAN_THANG',
    'SO_LAN_HOA',
    'SO_LAN_THUA',
    'TONG_DIEM',
    'XEP_HANG'
  ])
});

const DEFAULTS = Object.freeze({
  APP_NAME: 'Chốt Điểm',
  TIMEZONE: 'Asia/Ho_Chi_Minh',
  SCHEMA_VERSION: '1.0.0',
  DEFAULT_BET: 5,
  MAX_NOTE_LENGTH: 500
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SHEET_NAMES,
    CONFIG_KEYS,
    SESSION_STATUS,
    PLAYER_STATUS,
    MATCH_RESULT,
    ROUND_STATUS,
    HEADERS,
    DEFAULTS
  };
}
