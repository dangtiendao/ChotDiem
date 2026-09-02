/**
 * @fileoverview Main entry point exporting all core modules for Phase 1
 */

const constants = require('./constants');
const serializer = require('./serializer');
const scoring = require('./scoring');
const validation = require('./validation');
const schema = require('./schema');

module.exports = {
  ...constants,
  ...serializer,
  ...scoring,
  ...validation,
  ...schema
};
