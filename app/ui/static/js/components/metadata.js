var Ractive = require('ractive'),
    $ = require('jquery');

module.exports = Ractive.extend({
  template: '#metadataTmpl',
  isolated: true,
  debug: true,
  twoway: false,
  components: {
    'Carousel': require('./carousel')
  },
  data: {
    activeSlide: 0
  },
  init: function () {
    var progSlide  = 0,
        trackSlide = 1;

    this.on('track-display', function () {
      var currentSlide = this.get('activeSlide');
      this.set('activeSlide', (currentSlide + 1) % 2);
    });
    this.observe('nowPlaying', function (newValue) {
      if (newValue == null) {
        this.set('activeSlide', progSlide);
      }
    });
  }
});