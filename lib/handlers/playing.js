var utils  = require('radiodan-client').utils,
    logger = utils.logger('handlers-playing');

module.exports = function(players, ui, services, state) {
  return {
    start: startPlaying,
    stop:  stopPlaying
  };

  function startPlaying(service) {
    logger.info('startPlaying');

    logger.info(services.get(service));

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
