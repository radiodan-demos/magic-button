var ServerActionCreators = require('../actions/server-action-creators'),
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
  }
}