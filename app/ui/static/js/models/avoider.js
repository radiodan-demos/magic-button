var Backbone = require('backbone'),
    xhr = require('../xhr'),
    clone = require('../utils').clone;

module.exports = Backbone.Model.extend({
  isAvoiding: false,
  initialize: function () {
    /*
      Listen for remote service change events
    */
    this.get('eventSource').addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      switch(content.topic) {
        case 'avoider':
          var data = clone(content.data);
          data.start = data.start ? new Date(data.start) : null;
          data.end   = data.end   ? new Date(data.end)   : null;
          this.set(data);
          break;
        case 'settings.avoider':
          console.log('settings.avoider', content.data);
          break;
      }
    }.bind(this));
  },
  isStarted: function () {
    return this.get('isAvoiding');
  },
  start: function () {
    xhr.post('/avoider');
  },
  end: function () {
    xhr.delete('/avoider');
  }
});
