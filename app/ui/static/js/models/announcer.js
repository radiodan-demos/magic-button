var Backbone = require('backbone'),
    xhr = require('../xhr'),
    merge = require('../utils').merge,
    clone = require('../utils').clone,
    action = require('../actions/announce');

module.exports = Backbone.Model.extend({
  isAnnouncing: false,
  initialize: function () {
    xhr.get('/announcer/state.json')
       .then(function (state) {
          console.log('AnnouncerModel initial state', state);
          this.setState( JSON.parse(state) );
       }.bind(this));

    /*
      Listen for remote service change events
    */
    this.get('eventSource').addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      switch(content.topic) {
        case 'announcer':
          this.setState(content.data);
          break;
      }
    }.bind(this));
  },
  setState: function (state) {
    var data = clone(state);
    data.start = data.start ? new Date(data.start) : null;
    data.end   = data.end   ? new Date(data.end)   : null;
    this.set(data);
  },
  isStarted: function () {
    return this.get('isAnnouncing');
  },
  start: function () {
    xhr.post('/announcer');
  },
  end: function () {
    xhr.delete('/announcer');
  }
});
