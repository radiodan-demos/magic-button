var Ractive = require('ractive');

module.exports = Ractive.extend({
  template: '#controlsTmpl',
  isolated: true,
  components: {
    Playout      : require('./simple')('#playoutTmpl'),
    ServicesList : require('./services-list')
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
      }
    });
  }
});