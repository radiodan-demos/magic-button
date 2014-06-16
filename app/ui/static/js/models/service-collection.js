var Backbone = require('backbone'),
    Service  = require('./service.js');

module.exports = Backbone.Collection.extend({
  model: Service,
  isActive: function (id) {
    var current = this.find(function (item) { return item.isActive === true; });
    if (current.id) {
      return current.id === id;
    } else {
      return false;
    }
  }
});