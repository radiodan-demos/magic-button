var Logger = require('js-logger'),
    extend = require('underscore').extend,
    clone = require('underscore').clone,
    EventEmitter  = require('events').EventEmitter,
    AppDispatcher = require('../dispatcher/dispatcher'),
    ActionTypes   = require('../constants/constants').ActionTypes,
    Payload       = require('../constants/constants').Payload;

var currentErrorId = null;

var errors = {
  'GENERIC_ERROR': {
    msg: 'Something has gone wrong'
  },
  'CONNECTION_ERROR': {
    msg: 'This app can\'t connect to the radio'
  }
};

var ErrorStore = extend(new EventEmitter(), {
  GENERIC_ERROR: 'GENERIC_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  currentError: function () {
    var details;

    if (errors[currentErrorId]) {
      details = {
        message: errors[currentErrorId].msg
      };
    }

    return details;
  },
  createError: function (id) {
    // TODO: Validate
    currentErrorId = id;
    this.emitChange();
  },
  clearError: function () {
    currentErrorId = null;
    this.emitChange();
  },
  emitChange: function () {
    this.emit('change');
  },
  addChangeListener: function (callback) {
    this.on('change', callback);
  }
});

// ErrorStore.dispatchToken = AppDispatcher.register(function (payload) {
//   var source = payload.source,
//       action = payload.action;
//   switch(action.type) {
//     case ActionTypes.ERROR:
//       if (source === Payload.SERVER_ACTION) {
//         Logger.debug('Power: SERVER', action.type, action.state.data);
//         state = action.state.data;
//       } else {
//         state.isOn = !state.isOn;
//       }
//       Power.emitChange();
//       break;
//   }
// });

module.exports = ErrorStore;