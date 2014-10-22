var AppDispatcher = require('../dispatcher/dispatcher'),
    ActionTypes = require('../constants/constants').ActionTypes,
    PowerStore  = require('../stores/power'),
    AvoiderStore = require('../stores/avoider'),
    AnnouncerStore = require('../stores/announcer');

module.exports = {
  togglePower: function () {
    var newState;
    console.log('togglePower');
    AppDispatcher.handleViewAction({
       type: ActionTypes.POWER
    });
    newState = PowerStore.getState().isOn;
    require('../api/power')(newState);
  },
  changeVolume: function (vol) {
    console.log('changeVolume', vol);
    AppDispatcher.handleViewAction({
       type: ActionTypes.VOLUME,
       state: { volume: vol }
    });
    require('../api/volume')(vol);
  },
  changeService: function (serviceId) {
    console.log('changeService', serviceId);
    require('../api/service')(serviceId);
  },
  toggleAvoider: function () {
    var isAvoiding = AvoiderStore.getState().isAvoiding;
    console.log('toggleAvoider - current state', isAvoiding);
    require('../api/avoid').set(isAvoiding);
  },
  requestAvoiderSettings: function () {
    require('../api/avoid').settings();
  },
  avoiderSettings: function (params) {
    require('../api/avoid').settings(params);
  },
  toggleAnnouncer: function () {
    var isAnnouncing = AnnouncerStore.getState().isAnnouncing;
    console.log('toggleAnnouncer - current state', isAnnouncing);
    require('../api/announce')(isAnnouncing);
  },
};