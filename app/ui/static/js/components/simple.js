var Ractive = require('ractive');

module.exports = function (selector) {
  return Ractive.extend({
    template: selector,
    isolated: true
  });
};