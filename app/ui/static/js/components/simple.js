var Ractive = require('ractive');

module.exports = function (selector) {
  return Ractive.extend({
    template: selector,
    isolated: true,
    twoway: false,
    debug: true,
    components: {
      ServicesList: require('./services-list')
    }
  });
};