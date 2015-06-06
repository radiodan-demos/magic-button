var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure,
    ServerActionCreators = require('../actions/server-action-creators');

module.exports = function (isAnnouncing) {
  if (isAnnouncing == null) {
    xhr.get('/announcer')
       .then(function (data) {
          return JSON.parse(data);
       })
       .then(ServerActionCreators.receiveAnnouncerState, failure);
  } else {
    xhr((isAnnouncing ? 'DELETE' : 'POST'), '/announcer').catch(failure);
  }
}