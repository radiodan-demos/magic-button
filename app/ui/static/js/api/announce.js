var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure,
    ServerActionCreators = require('../actions/server-action-creators');

module.exports = function (isAnnouncing) {
  console.log('api - isAnnouncing', isAnnouncing, isAnnouncing == null);

  if (isAnnouncing == null) {
    xhr.get('/announcer/state.json')
       .then(function (data) {
          console.log('/announcer/state.json', data);
          return JSON.parse(data);
       })
       .then(ServerActionCreators.receiveAnnouncerState, failure);
  }
  var method = isAnnouncing ? 'DELETE' : 'POST';
  console.log('api - isAnnouncing', method);
  xhr(method, '/announcer').catch(failure);
}