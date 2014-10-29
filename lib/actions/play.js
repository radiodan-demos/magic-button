module.exports.create = create;

function create(players, ui, services, eventBus) {
  var instance = {
    id: 'play',
    states: ['standby', 'online'],
    determineStation: determineStation,
    action: action
  };

  return instance;

  function action(stationId) {
    stationId = determineStation(stationId);

    // emit LEDS
    ui.RGBLEDs.power.emit({
      emit: true, colour: ui.colours.green
    });

    return players.main.add({
      // add station
      clear: true,
      playlist: [services.playlist(stationId)]
    }).then(function() {
      // play
      return players.main.play();
    }).then(function(){
      // set service as active
      return services.change(stationId);
    });
  };

  // play given service, current service,
  // or default service
  function determineStation(stationId) {
    if(stationId) {
     return stationId;
    } else {
     return services.current() || services.default;
    }
  }
}
