var Backbone = require('backbone'),
    xhr = require('../xhr'),
    Service = require('./service'),
    ServiceCollection = require('./service-collection'),
    actions = {
      volume : require('../actions/volume'),
      service: require('../actions/service'),
      power  : require('../actions/power')
    };

var Radio = Backbone.Model.extend({
  initialize: function () {

    this.set({ services: new ServiceCollection() });

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
          this.setCurrentServiceById(content.data ? content.data.id : null);
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
    var services = this.parseServices(state.services || []);
    this.get('services').add(services);

    if (state.current) {
      this.setCurrentServiceById(state.current.id, state.current);
    }

    this.set({
      isOn     : state.power.isOn,
      volume   : state.audio.volume
    });
  },
  togglePower: function () {
    this.set({ isOn: !this.get('isOn') });
  },
  setCurrentServiceById: function (id, data) {
    console.log('setCurrentServiceById', id, data);
    var services = this.get('services');

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
  },
  parseServices: function (servicesData) {
    var services = [];

    if (servicesData && servicesData.length) {
      services = servicesData.map(function (json) {
        return new Service(json);
      });
    }

    return services;
  }
});


module.exports = Radio;