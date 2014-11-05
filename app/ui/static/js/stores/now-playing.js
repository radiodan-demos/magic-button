var Logger = require('js-logger'),
    extend = require('underscore').extend,
    clone  = require('underscore').clone,
    isEmpty = require('underscore').isEmpty,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    CurrentServiceStore = require('../stores/current-service'),
    Payload   = require('../constants/constants').Payload,
    ActionTypes   = require('../constants/constants').ActionTypes;

var state = {};

function update(id, data) {
  Logger.debug('NowPlaying update', id, data);
  state[id] = isEmpty(data) ? null : data;
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
      Logger.debug('NowPlaying', action.type, action.state);
      if (action.state.current && action.state.current.nowPlaying) {
        update(action.state.current.id, action.state.current.nowPlaying);
        Store.emitChange(action.state.current.id);
      }
      break;
    case ActionTypes.SERVICE:
      Logger.debug('NowPlaying: ', action.type, action.state);
      if (source === Payload.SERVER_ACTION && action.state.topic === 'service.changed') {
        AppDispatcher.waitFor([CurrentServiceStore.dispatchToken]);
        Logger.debug('NowPlaying: SERVER', action.type, action.state);
        if (action.state.data && action.state.data.nowPlaying) {
          update(action.state.data.id, action.state.data.nowPlaying);
          Store.emitChange(action.state.data.id);
        }
      }
      break;
    case ActionTypes.NOW_PLAYING:
      Logger.debug('NowPlaying: ', action.type, action.state);
      if (source === Payload.SERVER_ACTION) {
        Logger.debug('NowPlaying: SERVER', action.type, action.state);
        if (action.state.service && action.state.data) {
          update(action.state.service, action.state.data);
          Store.emitChange(action.state.service);
        }
      }
      break;
  }
});

module.exports = Store;