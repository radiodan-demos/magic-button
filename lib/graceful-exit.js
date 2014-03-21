var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = function(radiodan){
  return function() {
    clearPlayers(radiodan.cache.players).then(
      function() {
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
