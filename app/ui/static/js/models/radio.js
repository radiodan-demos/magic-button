var Backbone = require('backbone'),
    _ = require('underscore'),
    xhr = require('../xhr'),
    Service = require('./service'),
    ServiceCollection = require('./service-collection'),
    TunableServices = require('./tunable-services'),
    utils = require('../utils'),
    actions = {
      volume : require('../actions/volume'),
      service: require('../actions/service'),
      power  : require('../actions/power'),
      radioSettings  : require('../actions/radio-settings')
    };

var Radio = Backbone.Model.extend({
  initialize: function () {

    this.initialState = xhr.get('/radio/state.json')
                           .then(function (json) { return JSON.parse(json); });

    xhr.get('/radio/settings.json')
       .then(function (settings) {
          console.log('Radio.settings', JSON.parse(settings));
          this.set( { settings: JSON.parse(settings) } );
       }.bind(this));

    this.set({ isLoaded: false });

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
      Set settings of remote radio
    */
    this.on('change:settings', function (model, value, options) {
      console.log('change:settings', options);
      if ( options.type !== 'info' ) {
        console.log('change:settings - action');
        actions.radioSettings(value);
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
        case 'settings.radio':
          this.set({ settings: content.data }, { type: 'info' });
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
      Construct a ServiceCollection of available radio stations.
      This is used by other models to allow selection of services
      for things like tuning the radio or choosing which service
      to avoid with.
    */
    var services = new ServiceCollection(state.services || []);
    if (state.current) {
      services.updateServiceDataForId(state.current.id, state.current);
    }
    services.bindToEventSource(this.get('eventSource'));
    this.set('services', services);
    /*
      Listen for ServiceCollection changes
      and propagate to listeners
    */
    services.on('change', function (model, value, options) {
      this.trigger('change:services', model, value, options);
    }.bind(this));

    // Tunable Services
    var tunableServices = new TunableServices({
      services: services
    });
    this.set('tunableServices', tunableServices);


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
    console.log('setCurrentServiceById', id, opts);
    
    var tunableServices = this.get('tunableServices');
    tunableServices.tuneToId(id);

    try {
      this.set({ current: tunableServices.get('current') }, opts);
    } catch (e) {
      console.error('e', e);
    }
  },
  togglePreferredServiceById: function (serviceId, opts) {
    var settings = this.get('settings'),
        serviceIndex = settings.preferredServices.indexOf(serviceId);

    if (serviceIndex > -1) {
      console.log('remove');
      settings.preferredServices.splice(serviceIndex, 1);
    } else {
      console.log('add');
      settings.preferredServices.push(serviceId);
    }

    console.log('changed', settings.preferredServices);

    try {
      this.set({ settings: settings });
      // WORKAROUND: Because preferredServices is an array
      // Backbone won't fire a change event when its length 
      // changes
      this.trigger('change:settings', this, settings, opts || {});
    } catch (e) {
      console.error(e.stack);
    }
  }
});


module.exports = Radio;