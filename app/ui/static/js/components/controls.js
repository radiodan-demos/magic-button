var Ractive = require('ractive');

var StateAction

module.exports = Ractive.extend({
  template: '#controlsTmpl',
  isolated: true,
  twoway: false,
  debug: true,
  components: {
    Playout      : require('./simple')('#playoutTmpl'),
    ServicesList : require('./services-list'),
    Volume       : require('./simple')('#volumeTmpl'),
    Metadata     : require('./metadata'),
    Avoider      : require('./avoider'),
    Announcer    : require('./announcer')
  },
  data: {
    services: {
      isOpen: false
    }
  },
  init: function () {
    this.on({
      'services-panel-toggle': function (evt) {
        var currentState = this.get('services.isOpen');
        this.set('services.isOpen', !currentState);
      },
      'volume-panel-toggle': function (evt) {
        var currentState = this.get('volume.isOpen');
        this.set('volume.isOpen', !currentState);
      }
    });
  }
});