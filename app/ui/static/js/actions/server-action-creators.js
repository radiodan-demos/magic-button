'use strict';

var Logger = require('js-logger'),
    AppDispatcher = require('../dispatcher/dispatcher'),
    ActionTypes = require('../constants/constants').ActionTypes;

module.exports = {
  receiveInitialState: function (state) {
    Logger.debug('receiveInitialState', state);
    AppDispatcher.handleServerAction({
       type: ActionTypes.RECEIVE_INITIAL_STATE,
       state: state
    });
  },
  receiveStateUpdate: function (data) {
    var topic = data.topic.split('.')[0],
        state = data;

    Logger.debug('receiveStateUpdate', topic, state);

    AppDispatcher.handleServerAction({
       type: topic,
       state: state
    });
  },
  receiveAnnouncerState: function (state) {
    Logger.debug('receiveAnnouncerState', state);
    AppDispatcher.handleServerAction({
       type: ActionTypes.ANNOUNCER,
       state: state
    });
  },
  receiveAvoiderSettings: function (state) {
    Logger.debug('receiveAvoiderSettings', state);
    AppDispatcher.handleServerAction({
       type: ActionTypes.RECEIVE_AVOIDER_SETTINGS,
       state: state
    });
  },
  receiveRadioSettings: function (state) {
    Logger.debug('receiveRadioSettings', state);
    AppDispatcher.handleServerAction({
       type: ActionTypes.RECEIVE_RADIO_SETTINGS,
       state: state
    });
  }
};