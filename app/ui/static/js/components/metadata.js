var Ractive = require('ractive');

module.exports = Ractive.extend({
  template: '#metadataTmpl',
  isolated: true,
  debug: true,
  twoway: false,
  data: {
    view: 'prog',
    first: function (array) {
      return array[0];
    },
    imageUrl: function (template, size) {
      return template.replace('$recipe', size);
    }
  },
  init: function () {
    this.on('track-display', function () {
      var current = this.get('view');
      this.set('view', current === 'track' ? 'prog' : 'track');
    });
  }
});