module.exports = function (states) {

  var isOn = false;

  var powerOn = function (states, players, services, emit) {
    emit('power', { isOn: true });
    players.main.add({
      clear: true,
      playlist: services.get('6music')
    }).then(players.main.play);
    services.change('6music');
  };

  var powerOff = function (states, players, services, emit) {
    emit('power', { isOn: false });
    players.main.clear();
    players.avoider.clear();
    players.announcer.clear();
    services.change(null);
  };

  return {
    turnOn: function () {
      states.create({
        name: 'powerOn',
        enter: powerOn,
        exit:  function () {}
      }).enter();
      isOn = true;
    },
    turnOff: function () {
      states.create({
        name: 'powerOff',
        enter: powerOff,
        exit:  function () {}
      }).enter();
      isOn = false;
    },
    isOn: function () {
      return isOn;
    }
  }
}
