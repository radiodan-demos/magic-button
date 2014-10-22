var Logger = require('js-logger'),
    AppDispatcher = require('../dispatcher/dispatcher'),
    ActionTypes = require('../constants/constants').ActionTypes,
    PowerStore  = require('../stores/power'),
    AvoiderStore = require('../stores/avoider'),
    AnnouncerStore = require('../stores/announcer'),
    RadioSettingsStore = require('../stores/radio-settings');

module.exports = {
  togglePower: function () {
    var newState;
    Logger.debug('togglePower');
    AppDispatcher.handleViewAction({
       type: ActionTypes.POWER
    });
    newState = PowerStore.getState().isOn;
    require('../api/power')(newState);
  },
  changeVolume: function (vol) {
    Logger.debug('changeVolume', vol);
    AppDispatcher.handleViewAction({
       type: ActionTypes.VOLUME,
       state: { volume: vol }
    });
    require('../api/volume')(vol);
  },
  changeService: function (serviceId) {
    Logger.debug('changeService', serviceId);
    require('../api/service')(serviceId);
  },
  toggleAvoider: function () {
    var isAvoiding = AvoiderStore.getState().isAvoiding;
    Logger.debug('toggleAvoider - current state', isAvoiding);
    require('../api/avoid').set(isAvoiding);
  },
  requestAvoiderSettings: function () {
    require('../api/avoid').settings();
  },
  requestRadioSettings: function () {
    require('../api/radio-settings')();
  },
  avoiderSettings: function (params) {
    require('../api/avoid').settings(params);
  },
  toggleAnnouncer: function () {
    var isAnnouncing = AnnouncerStore.getState().isAnnouncing;
    Logger.debug('toggleAnnouncer - current state', isAnnouncing);
    require('../api/announce')(isAnnouncing);
  },
  toggleRadioSettingPreferredServer: function (serviceId) {
    RadioSettingsStore.togglePreferredService(serviceId);
    AppDispatcher.handleViewAction({
       type: ActionTypes.SETTINGS,
       state: RadioSettingsStore.getState()
    });
    require('../api/radio-settings')(RadioSettingsStore.getState());
  }
};