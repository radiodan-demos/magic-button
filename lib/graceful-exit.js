var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = function(radiodan){
  return function() {
    logger.debug("Stopping players before shutdown");
    clearPlayers(radiodan.cache.players).then(
      function() {
        logger.debug('Exited');
        process.exit(1);
      }
    );

    function clearPlayers(players) {
      var playerIds = Object.keys(players),
          resolved = utils.promise.resolve();

      if(playerIds.length === 0){
        return resolved;
      }

      return Object.keys(players).reduce(function(previous, current){
        return previous.then(players[current].clear);
      }, resolved);
    }
  };
};
