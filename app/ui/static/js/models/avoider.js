var Backbone = require('backbone'),
    clone = require('../utils').clone;

module.exports = Backbone.Model.extend({
  isAvoiding: false,
  start: null,
  end: null,
  initialize: function () {
    /*
      Listen for remote service change events
    */
    this.get('eventSource').addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      switch(content.topic) {
        case 'avoider':
          console.log('avoider event', content.data);
          var data = clone(content.data);
          data.start = data.start ? new Date(data.start) : null;
          data.end   = data.end   ? new Date(data.end)   : null;
          console.log('avoider event - set ', data);

          this.set(data);
          break;
        case 'settings.avoider':
          console.log('settings.avoider', content.data);
          break;
      }
    }.bind(this));
  }
});
