var utils  = require('radiodan-client').utils,
    defer  = utils.promise.defer,
    logger = utils.logger('handlers-playing');

module.exports = function(players, ui, services, state) {
  return {
    off: standby
  };

  function standby() {

    powerLightRed()
      .then(function () {
        return wait(3000);
      })
      .then(dimPowerLight);

    ui.RGBLEDs.magic.emit({
      emit: false
    });

    players.main.clear();
    players.avoider.clear();
    players.announcer.clear();
    services.change(null);
  }

  function powerLightRed() {
    return ui.RGBLEDs.power.emit({
      colour: ui.colours.red
    });
  }

  function dimPowerLight() {
    return ui.RGBLEDs.power.emit({
      colour: [76, 0, 0]
    });
  }

  function wait(delay) {
    var dfd = defer();
    setTimeout(dfd.resolve, delay);
    return dfd.promise;
  }
};
