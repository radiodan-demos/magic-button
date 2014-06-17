var Backbone = require('backbone'),
    xhr = require('../xhr'),
    Service = require('./service'),
    ServiceCollection = require('./service-collection'),
    utils = require('../utils'),
    actions = {
      volume : require('../actions/volume'),
      service: require('../actions/service'),
      power  : require('../actions/power')
    };

var Radio = Backbone.Model.extend({
  initialize: function () {

    this.set({ services: new ServiceCollection({ events: this.get('events') }) });

    /*
      Set current service of remote radio
    */
    this.on('change:current', function (model, value, options) {
      if ( options.type !== 'info' ) {
        actions.service(value.id);
      }
    });

    /*
      Set volume when this property is changed
    */
    this.on('change:volume', 
      utils.debounce(
        function (model, value, options) {
          if ( options.type !== 'info' ) {
            actions.volume(value);
          }
        },
        250
      )
    );

    /*
      Set power when this property is changed
      The boolean value indicates the target 
      state of the system.
    */
    this.on('change:isOn', function (model, value, options) {
      if ( options.type !== 'info' ) {
        actions.power(value);
      }
    });

    /*
      Listen for remote service change events
    */
    this.get('events').addEventListener('message', function (evt) {
      var content = JSON.parse(evt.data);
      switch(content.topic) {
        case 'service.changed':
          this.setCurrentServiceById(
            (content.data ? content.data.id : null), { type: 'info' }
          );
          break;
        case 'power':
          this.set({ isOn: content.data.isOn }, { type: 'info' });
          break;
        case 'audio.volume':
          this.set({ volume: content.data.volume }, { type: 'info' });
          break;
      }
    }.bind(this));

    this.fetch();
  },
  fetch: function () {
    xhr.get('/radio/state.json')
       .then( this.parse.bind(this) );
  },
  parse: function (json) {
    var state = JSON.parse(json);

    /*
      Services available
      Construct a ServiceCollection of available radio stations
    */
    this.get('services').set(state.services || []);

    if (state.current) {
      this.setCurrentServiceById(state.current.id);
    }

    this.set({
      isOn     : state.power.isOn,
      volume   : state.audio.volume
    });
  },
  togglePower: function () {
    this.set({ isOn: !this.get('isOn') });
  },
  setCurrentServiceById: function (id, opts) {
    var services = this.get('services');

    var oldCurrent = services.findWhere({ isActive: true }),
        newCurrent = services.findWhere({ id: id });

    if (oldCurrent) {
      oldCurrent.set({ isActive: false });
    }

    if (newCurrent) {
      newCurrent.set({ isActive: true  });
    }

    this.set({ current: newCurrent }, opts);
  }
});


module.exports = Radio;