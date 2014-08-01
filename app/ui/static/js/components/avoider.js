var Ractive = require('ractive');

module.exports = Ractive.extend({
  template: '#avoiderTmpl',
  isolated: true,
  data: {
    isActive: true,
    state: null
  },
  components: {
    CircularProgress: require('./circular-progress')
  },
  computed: {
    percentThrough: function () {
      var start = this.get('state.start'),
          end   = start - this.get('state.end'),
          now   = start - this.get('now'),
          percentThrough;

      if (start && end && now) {
        percentThrough = (start - (start-now)) / (start- (start-end));
        percentThrough = percentThrough.toFixed(2) * 100;
      }

      if (percentThrough < 0) {
        percentThrough = 0;
      }

      if (percentThrough > 100) {
        percentThrough = 100;
      }

      return percentThrough;
    },
    timeLeft: function () {
      var now   = this.get('now'),
          end   = this.get('state.end'),
          isInFuture = end > now,
          left = null;

      if (end && now && isInFuture) {
        left = Math.round( (end - now) / 1000);
      }

      return left;
    }
  },
  init: function () {
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