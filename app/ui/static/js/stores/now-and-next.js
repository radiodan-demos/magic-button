var Logger = require('js-logger'),
    extend = require('underscore').extend,
    clone  = require('underscore').clone,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    CurrentServiceStore = require('../stores/current-service'),
    Payload   = require('../constants/constants').Payload,
    ActionTypes   = require('../constants/constants').ActionTypes;

var state = {};

function update(id, data) {
  Logger.debug('NowAndNext update', id, data)
  state[id] = data;
}

var Store = extend(new EventEmitter(), {
  get: function (id) {
    if (state[id]) {
      return clone(state[id]);
    }
  },
  emitChange: function (id) {
    this.emit('change', id);
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
      AppDispatcher.waitFor([CurrentServiceStore.dispatchToken]);
      Logger.debug('NowAndNext', action.type, action.state);
      if (action.state.current && action.state.current.nowAndNext) {
        update(action.state.current.id, action.state.current.nowAndNext);
        Store.emitChange(action.state.current.id);
      }
      break;
    case ActionTypes.SERVICE:
      Logger.debug('NowAndNext: ', action.type, action.state);
      if (source === Payload.SERVER_ACTION) {
        AppDispatcher.waitFor([CurrentServiceStore.dispatchToken]);
        Logger.debug('NowAndNext: SERVER', action.type, action.state);
        if (action.state.data && action.state.data.nowAndNext) {
          update(action.state.data.id, action.state.data.nowAndNext);
          Store.emitChange(action.state.data.id);
        }
      }
      break;
    case ActionTypes.NOW_AND_NEXT:
      Logger.debug('NowAndNext: ', action.type, action.state);
      if (source === Payload.SERVER_ACTION) {
        Logger.debug('NowAndNext: SERVER', action.type, action.state);
        if (action.state.service && action.state.data) {
          update(action.state.service, action.state.data);
          Store.emitChange(action.state.service);
        }
      }
      break;
  }
});

module.exports = Store;