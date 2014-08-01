var Ractive = require('ractive');

module.exports = Ractive.extend({
  template: '#avoiderTmpl',
  isolated: true,
  data: {
    isActive: true,
    state: null
  },
  computed: {
    timeLeft: function () {
      var now   = this.get('now'),
          end   = this.get('state.end'),
          isInFuture = end > now,
          left = null;

      if (end && now && isInFuture) {
        left = (end - now) / 1000;
      }

      return left;
    }
  },
  init: function () {
    this.observe('state.end', function () {
      window.setTimeout(function () {
        this.set('now', new Date());
      }.bind(this), 1000);
    });
  }
});