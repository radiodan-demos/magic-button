var Ractive = require('ractive');

module.exports = Ractive.extend({
  template: '#controlsTmpl',
  isolated: true,
  twoway: false,
  debug: true,
  components: {
    Playout      : require('./simple')('#playoutTmpl'),
    ServicesList : require('./services-list'),
    Metadata     : require('./metadata'),
    Avoider      : require('./avoider'),
    Announcer    : require('./announcer')
  },
  data: {
    servicesPanel: {
      isOpen: false
    }
  },
  init: function () {
    this.on({
      'services-panel-toggle': function (evt) {
        var currentState = this.get('servicesPanel.isOpen');
        this.set('servicesPanel.isOpen', !currentState);
      },
      'volume-panel-toggle': function (evt) {
        var currentState = this.get('volume.isOpen');
        this.set('volume.isOpen', !currentState);
      }
    });
  }
});