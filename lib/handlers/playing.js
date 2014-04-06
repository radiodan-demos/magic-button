var utils = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports = function(players, services) {
  return {
    start: startPlaying,
    stop:  stopPlaying
  };

  function startPlaying(service) {
    logger.info('startPlaying');

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
