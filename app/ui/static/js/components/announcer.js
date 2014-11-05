var Ractive = require('ractive');

module.exports = Ractive.extend({
  template: '#announcerTmpl',
  isolated: true,
  twoway: false,
  debug: true,
  data: {
    settingsOpen: false,
    state: null
  },
  components: {
    CircularProgress: require('./circular-progress')
  },
  computed: {
    percentThrough: function () {
      var start = this.get('state.start'),
          end   = this.get('state.end'),
          now   = this.get('now'),
          duration,
          current,
          percentThrough;

      if (start && end && now) {
        duration = end - start;
        current  = now - start;

        percentThrough = current / duration;
        percentThrough = percentThrough.toFixed(2) * 100;
      } else if ( this.get('state.isAnnouncing') ) {
        percentThrough = 100;
      }

      if (percentThrough < 0) {
        percentThrough = 0;
      }

      if (percentThrough > 100) {
        percentThrough = 100;
      }

      // console.log('percentThrough', percentThrough, start, end, now);

      return percentThrough;
    },
    timeLeft: function () {
      var now   = this.get('now'),
          end   = this.get('state.end'),
          isInFuture = end > now,
          left = null;

      if (end && now && isInFuture) {
        left = this.formatTimeDiff( Math.round( (end - now) ) );
      }

      return left;
    }
  },
  oninit: function () {
    this.observe('state.end', function (newValue, oldValue) {
      if (newValue && !this.countdownTimerId) {
        this.countdownTimerId = window.setInterval(function () {
          this.set('now', new Date());
        }.bind(this), 1000);
      } else {
        window.clearInterval(this.countdownTimerId);
        this.countdownTimerId = null;
      }
    });
  }
});