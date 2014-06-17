var Backbone = require('backbone'),
    Service  = require('./service.js');

module.exports = Backbone.Collection.extend({
  model: Service,
  initialize: function (props) {
    props.events.addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      if (content.topic === 'service.changed' && content.data && content.data.id) {
        this.updateServiceDataForId(content.data.id, content.data);
      }
    }.bind(this));
  },
  updateServiceDataForId: function (id, data) {
    console.log('updateServiceDataForId', id, data);
    var service = this.findWhere({ id: id });
    service.set(data);
  },
  isActive: function (id) {
    var current = this.find(function (item) { return item.isActive === true; });
    if (current.id) {
      return current.id === id;
    } else {
      return false;
    }
  }
});