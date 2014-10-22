var Logger = require('js-logger'),
    extend = require('underscore').extend,
    clone = require('underscore').clone,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    Payload       = require('../constants/constants').Payload,
    ActionTypes   = require('../constants/constants').ActionTypes;

var state = {
  volume: null
};

var Store = extend(new EventEmitter(), {
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
    case ActionTypes.RECEIVE_INITIAL_STATE:
      state = action.state.audio;
      Store.emitChange();
      break;
    case ActionTypes.AUDIO:
      if (source === Payload.SERVER_ACTION) {
        Logger.debug('Audio: SERVER', action.type, action.state);
        state = action.state.data;
      } else {
        Logger.debug('Audio: CHANGE', action.type, action.state);
        state.volume = action.state.volume;
      }
      Store.emitChange();
      break;
  }
});

module.exports = Store;