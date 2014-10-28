var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure,
    ServerActionCreators = require('../actions/server-action-creators');

module.exports.set = function (isAvoiding) {
  var method = isAvoiding ? 'DELETE' : 'POST';
  xhr(method, '/avoider');
}

module.exports.settings = function (data) {
  if (!data) {
    xhr.get('/avoider/settings.json')
       .then(function (data) {
        return JSON.parse(data);
       })
       .then(ServerActionCreators.receiveAvoiderSettings);
  } else {
    var payload = JSON.stringify(data),
        opts = {
          headers: { 'Content-type': 'application/json' },
          data: payload
        };
    xhr.post('/avoider/settings.json', opts);
  }
}