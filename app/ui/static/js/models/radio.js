var Backbone = require('backbone'),
    actions = {
      volume : require('../actions/volume'),
      service: require('../actions/service')
    };

var Radio = Backbone.Model.extend({
  initialize: function () {
    /*
      Set current service of remote radio
    */
    this.on('change:current', function (model, value, options) {
      if ( options.type !== 'info' ) {
        actions.service(value);
      }
    });

    /*
      Set volume when this property is changed
    */
    this.on('change:volume', function (model, value, options) {
      if ( options.type !== 'info' ) {
        actions.volume(value);
      }
    });

    /*
      Listen for remote service change events
    */
    this.get('events').addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      switch(content.topic) {
        case 'service.changed':
          this.setCurrentServiceById(content.data ? content.data.id : null);
          break;
        case 'power':
          this.set({ power: content.data });
          break;
        case 'audio.volume':
          this.set({ volume: content.data.volume }, { type: 'info' });
          break;
      }
    }.bind(this));
  },
  setCurrentServiceById: function (id, data) {
    console.log('setCurrentServiceById', id, data);

    var oldCurrent = services.findWhere({ isActive: true }),
        newCurrent = services.findWhere({ id: id });

    if (oldCurrent) {
      oldCurrent.set({ isActive: false });
    }

    if (newCurrent) {
      newCurrent.set({ isActive: true  });

      // Augment current service with new data
      if (data) {
        newCurrent.set(data);
      }
    }

    this.set({ current: newCurrent }, { type: 'info' });
  }
});


module.exports = Radio;