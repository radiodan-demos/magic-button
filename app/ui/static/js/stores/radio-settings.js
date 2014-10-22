var extend = require('underscore').extend,
    clone = require('underscore').clone,
    without = require('underscore').without,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    Payload       = require('../constants/constants').Payload,
    ActionTypes   = require('../constants/constants').ActionTypes,
    ServicesStore = require('../stores/services');

var state = {};

var Store = extend(new EventEmitter(), {
  togglePreferredService: function (serviceId) {
    if (state.preferredServices && state.preferredServices.indexOf(serviceId) > -1) {
      state.preferredServices = without(state.preferredServices, serviceId);
    } else {
      state.preferredServices.push(serviceId);
    }
  },
  getState: function () {
    return clone(state);
  },
  emitChange: function () {
    this.emit('change');
  },
  addChangeListener: function (callback) {
    this.on('change', callback);
  }
});

Store.dispatchToken = AppDispatcher.register(function (payload) {
  var source = payload.source,
      action = payload.action;

  switch(action.type) {
    case ActionTypes.RECEIVE_RADIO_SETTINGS:
      console.log('Radio Settings: ', action.type, action.state);
      if (source === Payload.SERVER_ACTION) {
        console.log('Radio Settings: SERVER', action.type, action.state);
        state = clone(action.state);
        Store.emitChange();
      }
      break;
    case ActionTypes.SETTINGS:
      if (source === Payload.SERVER_ACTION && action.state.topic === 'settings.radio') {
        console.log('Radio Settings: SERVER', action.type, action.state);
        state = clone(action.state.data);
        Store.emitChange();
      }
      break;
  }
});

module.exports = Store;