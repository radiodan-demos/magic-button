module.exports.create = create;

function create(radiodan, settings, services, eventBus) {
  var instance = {
    id: 'play',
    states: ['standby', 'online']
  };

  instance.action = function(stationId) {
    // find stationId
    // emit LEDS
    // add station
    // play
    // set service as active
  };

  return instance;
}
