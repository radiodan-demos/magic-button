var Ractive = require('ractive'),
    d3      = require('../lib/d3');

var activeArc,
    inactiveArc,
    percentToAngle;

/*
  The arcs
*/
activeArc = d3.svg.arc()
              .innerRadius(44.4827586)
              .outerRadius(50)
              .startAngle(0);

inactiveArc = d3.svg.arc()
                .innerRadius(49.5)
                .outerRadius(50)
                .startAngle(0);

/*
  Helper to convert from 0-100 to 0-2Pi radians
*/
percentToAngle = d3.scale.linear()
                         .domain([0, 100])
                         .range([0, 2 * Math.PI])
                         .clamp([true]);

var initialState = {
  outerArcPath: inactiveArc({ endAngle: Math.PI * 2 }),
  progressArcPath: activeArc({ endAngle: 0 })
};

var CircularProgress = Ractive.extend({
  template: '#progressTempl',
  isolated: true,
  computed: {
    angle: function () {
      var percentThrough = this.get('percentThrough');
      return percentThrough ? percentToAngle(percentThrough) : 0;
    }
  },
  init: function () {
    this.set(initialState);

    this.observe('angle', function (angle) {
      arc = activeArc;
      this.set({
        progressArcPath: arc({ endAngle: angle })
      });
    });
  }
});

module.exports = CircularProgress;