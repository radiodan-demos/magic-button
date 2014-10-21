var Ractive = require('ractive');

module.exports = Ractive.extend({
  template: '#avoiderTmpl',
  isolated: true,
  twoway: true,
  debug: true,
  data: {
    settingsOpen: false,
    state: null
  },
  components: {
    CircularProgress: require('./circular-progress'),
    ServicesList: require('./services-list')
  },
  computed: {
    percentThrough: function () {
      var start = this.get('start'),
          end   = this.get('end'),
          now   = this.get('now'),
          duration,
          current,
          percentThrough;

      if (start && end && now) {
        duration = end - start;
        current  = now - start;

        percentThrough = current / duration;
        percentThrough = percentThrough.toFixed(2) * 100;
      } else if ( this.get('state.isAvoiding') ) {
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

    this.on('settings', function () {
      if (!this.get('settingsOpen')) {
        this.fire('settings-requested');
      }
      this.set('settingsOpen', !this.get('settingsOpen'));
    });

    this.on('avoid-service-setting', function (serviceId) {
      this.set('state.settings.serviceId', serviceId);
      this.fire('settings-changed', this.get('state.settings'));
    });

    this.on('state-settings-avoid-type', function (evt) {
      this.set('state.settings.avoidType', evt.node.value);
      this.fire('settings-changed', this.get('state.settings'));
    });

    // this.observe('state.settings', function (newValue, oldValue) {
    //   console.log('state.settings', newValue, this.get('state'));
    //   StateActionCreators.avoiderSettings(newValue);
    // });
  },
  formatTimeDiff: function (diffInMs) {
    var diffSecs = diffInMs / 1000;
    var mins = diffSecs / 60;
    var secsLeft = Math.abs(Math.floor(mins) - mins);
    secsLeft = Math.floor(secsLeft * 60);
    if (secsLeft < 10) {
      secsLeft = '0' + secsLeft;
    }
    return Math.floor(mins) + 'm ' + secsLeft;
  }
});