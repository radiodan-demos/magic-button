var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure;

module.exports = function (turnOn) {
  var method = turnOn ? 'PUT' : 'DELETE';
  xhr(method, '/radio/power');
}