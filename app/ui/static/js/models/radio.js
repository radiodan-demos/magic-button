var Backbone = require('backbone');

var Radio = Backbone.Model.extend({
  initialize: function () {
    /*
      Set remote radio state when current service
      is changed
    */
    this.on('change:current', function () {
      console.log('change:current -> xhr.POST /service/current');
    });

    /*
      Listen for remote service change events
    */
    this.get('events').addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      switch(content.topic) {
        case 'service.changed': 
          this.setCurrentServiceById(content.data.id);
          break;
        case 'power':
          this.set({ power: content.data });
          break;
        case 'audio.volume':
          this.set({ 'audio', content.data });
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

    this.set({ current: newCurrent });
  }
});


module.exports = Radio;