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

    this.initialState = xhr.get('/radio/state.json')
                           .then(function (json) { return JSON.parse(json); });

    this.set({ 
      services: new ServiceCollection({ 
        initialState: this.initialState,
        eventSource: this.get('eventSource') 
      }),
      isLoaded: false
    });

    /*
      Set current service of remote radio
    */
    this.on('change:current', function (model, value, options) {
      console.log('change:current', options);
      if ( options.type !== 'info' ) {
        console.log('change:current - action');
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
    this.get('eventSource').addEventListener('message', function (evt) {
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
    this.initialState
        .then( this.parse.bind(this) );
  },
  parse: function (state) {
    console.log('RadioModel.parse', state);

    /*
      Services available
      Construct a ServiceCollection of available radio stations
    */
    this.get('services').set(state.services || []);

    if (state.current) {
      this.setCurrentServiceById(state.current.id, { type: 'info' });
    }

    console.log('RadioModel - current');

    this.set({
      isOn     : state.power.isOn,
      volume   : state.audio.volume,
      isLoaded : true
    }, { type: 'info' });
  },
  togglePower: function () {
    var isOn = !this.get('isOn');
    this.set({ isOn: isOn });
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

    console.log('setCurrentServiceById: old %o, new %o', oldCurrent, newCurrent);

    try {
      this.set({ current: newCurrent }, opts);
    } catch (e) {
      console.error('e', e);
    }

    console.log('set({ current: newCurrent })')
  }
});


module.exports = Radio;