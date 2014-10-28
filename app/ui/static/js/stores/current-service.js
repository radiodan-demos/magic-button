var Logger = require('js-logger'),
    extend = require('underscore').extend,
    clone = require('underscore').clone,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    Payload       = require('../constants/constants').Payload,
    ActionTypes   = require('../constants/constants').ActionTypes,
    ServicesStore = require('../stores/services');

var currentServiceId = null;

var Store = extend(new EventEmitter(), {
  getCurrentId: function () {
    return currentServiceId;
  },
  getCurrent: function () {
    return ServicesStore.getService(currentServiceId);
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
    case ActionTypes.RECEIVE_INITIAL_STATE:
      Logger.debug('CurrentService: ', action.type, action.state);
      currentServiceId = action.state.current ? action.state.current.id : null;
      Store.emitChange();
      break;
    case ActionTypes.SERVICE:
      Logger.debug('CurrentService: ', action.type, action.state);
      if (source === Payload.SERVER_ACTION && action.state.topic === 'service.changed') {
        Logger.debug('CurrentService: SERVER', action.type, action.state);
        currentServiceId = action.state.data ? action.state.data.id : null;
      } else {
        Logger.debug('CurrentService: CHANGE', action.type, action.state);
        // state.volume = action.state.volume;
      }
      Store.emitChange();
      break;
  }
});

module.exports = Store;