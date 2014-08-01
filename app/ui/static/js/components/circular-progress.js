var Ractive = require('ractive'),
    d3      = require('../lib/d3');

var activeArc,
    inactiveArc;

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

var initialState = {
  outerArcPath: inactiveArc({ endAngle: Math.PI * 2 }),
  progressArcPath: activeArc({ endAngle: 0 })
};

var CircularProgress = Ractive.extend({
  template: '#progressTempl',
  isolated: true,
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