'use strict';

var AppDispatcher = require('../dispatcher/dispatcher'),
    ActionTypes = require('../constants/constants').ActionTypes;

module.exports = {
  receiveInitialState: function (state) {
    console.log('receiveInitialState', state);
    AppDispatcher.handleServerAction({
       type: ActionTypes.RECEIVE_INITIAL_STATE,
       state: state
    });
  },
  receiveStateUpdate: function (data) {
    var topic = data.topic.split('.')[0],
        state = data;

    console.log('receiveStateUpdate', topic, state);

    AppDispatcher.handleServerAction({
       type: topic,
       state: state
    });
  },
  receiveAnnouncerState: function (state) {
    console.log('receiveAnnouncerState', state);
    AppDispatcher.handleServerAction({
       type: ActionTypes.ANNOUNCER,
       state: state
    });
  },
  receiveAvoiderSettings: function (state) {
    console.log('receiveAvoiderSettings', state);
    AppDispatcher.handleServerAction({
       type: ActionTypes.RECEIVE_AVOIDER_SETTINGS,
       state: state
    });
  },
  receiveRadioSettings: function (state) {
    console.log('receiveRadioSettings', state);
    AppDispatcher.handleServerAction({
       type: ActionTypes.RECEIVE_RADIO_SETTINGS,
       state: state
    });
  }
};