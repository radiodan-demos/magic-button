var extend = require('underscore').extend,
    clone = require('underscore').clone,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    ActionTypes   = require('../constants/constants').ActionTypes,
    Payload       = require('../constants/constants').Payload;

var state = {
  isOn: null
};

var Power = extend(new EventEmitter(), {
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

Power.dispatchToken = AppDispatcher.register(function (payload) {
  var source = payload.source,
      action = payload.action;

  switch(action.type) {
    case ActionTypes.RECEIVE_INITIAL_STATE:
      console.log('Power: RECEIVE_INITIAL_STATE', action.type, action.state.power);
      state = action.state.power;
      Power.emitChange();
      break;
    case ActionTypes.POWER:
      if (source === Payload.SERVER_ACTION) {
        console.log('Power: SERVER', action.type, action.state.data);
        state = action.state.data;
      } else {
        state.isOn = !state.isOn;
      }
      Power.emitChange();
      break;
  }
});

module.exports = Power;