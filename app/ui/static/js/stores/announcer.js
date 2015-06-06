var Logger = require('js-logger'),
    extend = require('underscore').extend,
    clone = require('underscore').clone,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    Payload       = require('../constants/constants').Payload,
    ActionTypes   = require('../constants/constants').ActionTypes,
    ServicesStore = require('../stores/services');

var state = {};

function set(data) {
  data = data || {};
  state = clone(data);
  if (data.start) { state.start = new Date(data.start); }
  if (data.end)   { state.end   = new Date(data.end);   }
}

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
      Logger.debug('Announcer: ', action.type, action.state);
      set(action.state.announcer);
      Store.emitChange();
      break;
    case ActionTypes.ANNOUNCER:
      Logger.debug('Announcer: ', action.type, action.state);
      if (source === Payload.SERVER_ACTION) {
        Logger.debug('Announcer: SERVER', action.type, action.state);
        set(action.state.data ? action.state.data : action.state);
        Store.emitChange();
      } else {
        Logger.debug('Announcer: VIEW ACTION pre', state.isAnnouncing);
        state.isAnnouncing = !state.isAnnouncing;
        Logger.debug('Announcer: VIEW ACTION post', state.isAnnouncing);
        Store.emitChange();
      }
      break;
  }
});

module.exports = Store;