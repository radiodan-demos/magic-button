var Ractive = require('ractive');

module.exports = Ractive.extend({
  template: '#servicesTmpl',
  isolated: true,
  twoway: false,
  debug: true,
  init: function () {
    var self = this;
    this.on({
      'services-partial': function (evt) {
        evt.original.preventDefault();
        var serviceId = evt.context.id;
        self.fire('selected', serviceId);
      }
    });
  }
});