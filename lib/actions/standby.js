var utils  = require('radiodan-client').utils;

module.exports.create = create;

function create(players, ui, audio, services, eventBus) {
  var instance = {
    name: 'standby',
    events: [{
      name: 'standby',
      states: ['online'],
      action: action
    }, {
      name: 'power',
      states: ['online'],
      action: action
    }]
  },
  dimTimerId;

  return instance;

  function action() {
    powerLightRed();
    ui.RGBLEDs.power.clearAndEnqueue(dimPowerLight, 3000);
      // .then(function () {
        
      // });

    ui.RGBLEDs.magic.emit({
      emit: false
    });

    players.main.clear();
    players.avoider.clear();
    players.announcer.clear();

    this.transition('standby');

    eventBus.emit('power', { isOn: false });

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
