module.exports.create = create;

function create(players, ui, audio, services, eventBus) {
  var instance = {
    name: 'play',
    determineStation: determineStation,
    events: [{
      name: 'play',
      states: ['standby', 'online'],
      action: action
    },{
      name: 'power',
      states: ['standby'],
      action: action
    }]
  };

  return instance;

  function action(stationId) {
    var device = this;

    stationId = determineStation(stationId);

    // emit LEDS
    ui.RGBLEDs.power.clearQueue();

    ui.RGBLEDs.power.emit({
      emit: true, colour: ui.colours.green
    });

    players.announcer.clear();
    players.avoider.clear();

    eventBus.emit('power', { isOn: true });

    // set service as active
    services.change(stationId);

    return players.main.add({
      // add station
      clear: true,
      playlist: [services.playlist(stationId)]
    }).then(function() {
      // play
      return players.main.play();
    }).then(function(){
      // update device state
      device.transition('online');
      return;
    });

  };

  // play given service or current service
  function determineStation(stationId) {
    if(stationId) {
     return stationId;
    } else {
     return services.current();
    }
  }
}
