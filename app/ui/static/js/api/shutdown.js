var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure;

module.exports = function () {
  xhr('POST', '/radio/shutdown');
}