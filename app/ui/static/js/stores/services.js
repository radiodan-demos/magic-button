var extend = require('underscore').extend,
    clone  = require('underscore').clone,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    ActionTypes   = require('../constants/constants').ActionTypes;

var services = {};

function addService(data) {
  if (data.id) {
    services[data.id] = data;
  }
}

var Store = extend(new EventEmitter(), {
  getAllServicesAsArray: function () {
    return Object.keys(services).map(Store.getService);
  },
  getAllServices: function () {
    return clone(services);
  },
  getService: function (id) {
    if (services[id]) {
      return clone(services[id]);
    }
  },
  emitChange: function () {
    this.emit('change');
  },
  addChangeListener: function (callback) {
    this.on('change', callback);
  }
});

Store.dispatchToken = AppDispatcher.register(function (payload) {
  var action = payload.action;

  switch(action.type) {
    case ActionTypes.RECEIVE_INITIAL_STATE:
      console.log('Services', action.type, action.state.services);
      action.state.services.forEach(addService);
      Store.emitChange();
      break;
  }
});

module.exports = Store;