var ServerActionCreators = require('../actions/server-action-creators'),
    StateActionCreators = require('../actions/state-action-creators'),
    setGlobalLogLevel = require('./logger'),
    xhr = require('../xhr');

module.exports = {
  getInitialState: function () {
    return xhr.get('/radio/state.json')
       .then(function (data) {
          try {
            var json = JSON.parse(data);
          } catch (err) {
            // Handle error
          }

          if (json.debug && json.debug.logLevel) {
            setGlobalLogLevel(json.debug.logLevel);
          }

          ServerActionCreators.receiveInitialState(json);

          return json;
       });
  },
  connectEventStream: function () {
    var events = new EventSource('/events');
    events.addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      ServerActionCreators.receiveStateUpdate(content);
    });
    events.addEventListener('error', function (evt) {
      StateActionCreators.createConnectionError();
    });
    events.addEventListener('open', function (evt) {
      StateActionCreators.clearError();
    });
  }
}