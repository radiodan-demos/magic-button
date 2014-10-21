var extend = require('underscore').extend,
    clone  = require('underscore').clone,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    CurrentServiceStore = require('../stores/current-service'),
    Payload   = require('../constants/constants').Payload,
    ActionTypes   = require('../constants/constants').ActionTypes;

var state = {};

function update(id, data) {
  console.log('NowAndNext update', id, data)
  state[id] = data;
}

var Store = extend(new EventEmitter(), {
  get: function (id) {
    if (state[id]) {
      return clone(state[id]);
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
  var source = payload.source,
      action = payload.action;

  switch(action.type) {
    case ActionTypes.RECEIVE_INITIAL_STATE:
      AppDispatcher.waitFor([CurrentServiceStore.dispatchToken]);
      console.log('NowAndNext', action.type, action.state);
      if (action.state.current && action.state.current.nowAndNext) {
        update(action.state.current.id, action.state.current.nowAndNext);
        Store.emitChange();
      }
      break;
    case ActionTypes.SERVICE:
      console.log('NowAndNext: ', action.type, action.state);
      if (source === Payload.SERVER_ACTION && action.state.topic === 'service.changed') {
        AppDispatcher.waitFor([CurrentServiceStore.dispatchToken]);
        console.log('NowAndNext: SERVER', action.type, action.state);
        if (action.state.data && action.state.data.nowAndNext) {
          update(action.state.data.id, action.state.data.nowAndNext);
        }
      } else {
        console.log('NowAndNext: CHANGE', action.type, action.state);
        // state.volume = action.state.volume;
      }
      Store.emitChange();
      break;
  }
});

module.exports = Store;