var xhr = require('../xhr'),
    utils = require('../utils'),
    success = utils.success,
    failure = utils.failure;

module.exports = function (data) {
  console.warn('data', data);
  var payload = JSON.stringify(data),
      opts = {
        headers: { 'Content-type': 'application/json' },
        data: payload
      };
  console.log('Radio settings changed', opts);
  xhr.post('/radio/settings.json', opts);
}