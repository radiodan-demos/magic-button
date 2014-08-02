var Backbone = require('backbone'),
    xhr = require('../xhr'),
    merge = require('../utils').merge,
    clone = require('../utils').clone,
    avoiderAction = require('../actions/avoid');

module.exports = Backbone.Model.extend({
  isAvoiding: false,
  initialize: function () {
    xhr.get('/avoider/state.json')
       .then(function (state) {
          console.log('AvoiderModel initial state', state);
          this.set( JSON.parse(state) );
       }.bind(this));

    xhr.get('/avoider/settings.json')
       .then(function (settings) {
          console.log('Avoider.settings', JSON.parse(settings));
          this.set( { settings: JSON.parse(settings) } );
       }.bind(this));
    
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
          this.set( { settings: content.data } );
          break;
      }
    }.bind(this));
  },
  updateSettings: function (settings) {
    var merged = merge(this.get('settings'), settings);
    avoiderAction.settings(merged);
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
