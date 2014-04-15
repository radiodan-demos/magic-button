var utils  = require('radiodan-client').utils,
    logger = utils.logger('handlers-playing');

module.exports = function(players, ui, services, state) {
  return {
    start: startPlaying,
    stop:  stopPlaying
  };

  function startPlaying(service) {
    logger.info('startPlaying');

    // play set service, or current service,
    // or whatever was playing before we stopped before.
    service = service || services.current() || services.revert();

    ui.RGBLEDs.power.emit({
      emit: true, colour: ui.colours.green
    });

    ui.RGBLEDs.magic.emit({
      emit: true, colour: ui.colours.white
    });

    return players.main.add({
      clear: true,
      playlist: [services.get(service)]
    })
    .then(players.main.play)
    .then(function(){
      services.change(service);
    });
  }

  function stopPlaying() {
    logger.info('stopPlaying');
  }
}
