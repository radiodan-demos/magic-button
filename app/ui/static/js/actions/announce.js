var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure;

module.exports = function (isAnnouncing) {
  var method = isAnnouncing ? 'DELETE' : 'POST';
  xhr(method, '/announcer');
}