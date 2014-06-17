var Backbone = require('backbone'),
    Service  = require('./service.js');

module.exports = Backbone.Collection.extend({
  model: Service,
  initialize: function (props) {

    props.initialState
         .then(function (state) {
            if (state.current) {
              this.updateServiceDataForId(state.current.id, state.current);
            }
         }.bind(this));

    props.events.addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      switch (content.topic) {
        case 'service.changed': 
          if (content.data && content.data.id) {
            this.updateServiceDataForId(content.data.id, content.data);
          }
          break;
        case 'nowPlaying':
          this.updateNowPlayingDataForId(content.service, content.data);
          break;
        case 'nowAndNext':
          this.updateNowAndNextDataForId(content.service, content.data);
          break;
      }
    }.bind(this));
  },
  updateNowPlayingDataForId: function (id, data) {
    var service = this.findWhere({ id: id });
    service.set({ nowPlaying: data });
  },
  updateNowAndNextDataForId: function (id, data) {
    var service = this.findWhere({ id: id });
    service.set({ nowAndNext: data });
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