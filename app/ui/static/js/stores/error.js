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
    message: 'Something has gone wrong',
  },
  'EXIT_ERROR': {
    message: 'The radio has crashed unexpectedly, please wait while it restarts',
    priority: 10
  },
  'CONNECTION_ERROR': {
    message: 'This app can\'t connect to the radio'
  }
};

function getErrorDetails(id) {
  var err = clone(errors[id]);

  if (err) {
    err.priority = err.priority || 0;
  }

  return err;
}

var ErrorStore = extend(new EventEmitter(), {
  GENERIC_ERROR: 'GENERIC_ERROR',
  EXIT_ERROR: 'EXIT_ERROR',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  currentError: function () {
    var details = getErrorDetails(currentErrorId);
    if (details) {
      return {
        message: details.message
      };
    } else {
      return null;
    }
  },
  createError: function (id) {
    var current = getErrorDetails(currentErrorId)
        newError = getErrorDetails(id);

    if (!current || current.priority <= newError.priority) {
      currentErrorId = id;
      this.emitChange();
    } else {}
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

ErrorStore.dispatchToken = AppDispatcher.register(function (payload) {
  var source = payload.source,
      action = payload.action;
  switch(action.type) {
    case ActionTypes.EXIT:
      ErrorStore.createError(ErrorStore.EXIT_ERROR);
      break;
  }
});

module.exports = ErrorStore;