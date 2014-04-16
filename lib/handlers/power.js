var utils  = require('radiodan-client').utils,
    logger = utils.logger('handlers-playing');

module.exports = function(players, ui, services, state) {
  return {
    off: standby
  };

  function standby() {
    ui.RGBLEDs.power.emit({
      emit: true, colour: ui.colours.red
    });

    ui.RGBLEDs.magic.emit({
      emit: false
    });

    players.main.clear();
    players.avoider.clear();
    players.announcer.clear();
    services.change(null);
  }
};
