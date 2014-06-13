var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure;

module.exports = function (value) {
  var isOn = value,
      method = isOn ? 'DELETE' : 'PUT';

  xhr(method, '/radio/power');
}