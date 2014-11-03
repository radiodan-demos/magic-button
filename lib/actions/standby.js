var utils  = require('radiodan-client').utils;

module.exports.create = create;

function create(players, ui, services, eventBus) {
  var instance = {
    id: 'standby',
    states: ['online'],
    action: action
  };

  return instance;

  function action() {
    powerLightRed()
      .then(function () {
        return wait(3000);
      })
      .then(dimpowerlight);

    ui.RGBLEDs.magic.emit({
      emit: false
    });

    players.main.clear();
    players.avoider.clear();
    players.announcer.clear();
    // TODO: Do we have to do this?
    services.change(null);

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
      var dfd = utils.promise.defer();
      setTimeout(dfd.resolve, delay);
      return dfd.promise;
    }
  }
}
