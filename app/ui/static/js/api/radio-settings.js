var xhr = require('../xhr'),
    utils = require('../utils'),
    success = utils.success,
    failure = utils.failure,
    ServerActionCreators = require('../actions/server-action-creators');

module.exports = function (data) {
  if (!data) {
    xhr.get('/radio/settings.json')
       .then(function (data) {
        return JSON.parse(data);
       })
       .then(ServerActionCreators.receiveRadioSettings)
       .catch(failure);
  } else {
    console.warn('data', data);
    var payload = JSON.stringify(data),
        opts = {
          headers: { 'Content-type': 'application/json' },
          data: payload
        };
    xhr.post('/radio/settings.json', opts).catch(failure);
  }
}