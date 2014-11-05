var Ractive = require('ractive'),
    $ = require('jquery'),
    isEmpty = require('underscore').isEmpty;

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
  oninit: function () {
    var progSlide  = 0,
        trackSlide = 1;

    this.on('track-display', function () {
      var currentSlide = this.get('activeSlide');
      this.set('activeSlide', (currentSlide + 1) % 2);
    });
    this.observe('nowPlaying', function (newValue) {
      if ( isEmpty(newValue) ) {
        this.set('activeSlide', progSlide);
      }
    });
  }
});