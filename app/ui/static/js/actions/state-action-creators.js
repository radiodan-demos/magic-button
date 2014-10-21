var AppDispatcher = require('../dispatcher/dispatcher'),
    ActionTypes = require('../constants/constants').ActionTypes,
    PowerStore  = require('../stores/power');

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
  }
};