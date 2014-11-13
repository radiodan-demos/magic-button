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
    this.observe('nowAndNext.0', function (newValue) {
      var start, end, now,
          duration, timeLeft, timeThrough, percentage;

      if (newValue && newValue.start && newValue.end) {
        start = newValue.start.valueOf();
        end   = newValue.end.valueOf();
        now   = Date.now();

        duration = end - start;
        timeThrough = now - start;
        timeLeft = end - now;
        percentage = (timeThrough / duration) * 100 || 0;

        if (percentage) {
          this.set('progress.percentage', percentage);
          this.animate('progress.percentage', 100, { duration: timeLeft });
        } else {
          this.set('progress', {});
        }
      } else {
        this.set('progress', {});
      }
    });
  }
});