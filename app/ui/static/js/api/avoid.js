var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure;

module.exports.set = function (isAvoiding) {
  var method = isAvoiding ? 'DELETE' : 'POST';
  xhr(method, '/avoider');
}

module.exports.settings = function (data) {
  var payload = JSON.stringify(data),
      opts = {
        headers: { 'Content-type': 'application/json' },
        data: payload
      };
  console.log('Avoid settings changed', opts);
  xhr.post('/avoider/settings.json', opts);
}