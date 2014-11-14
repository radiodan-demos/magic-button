var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = function(radiodan, state){
  return function() { return gracefulExit(radiodan, state); }
};

function gracefulExit(radiodan, state) {
  // Give the app a chance to clean up
  state.handle('exit');

  // if promise does not resolve quickly enough, exit anyway
  setTimeout(exitWithCode(2), 3000);

  return clearPlayers(radiodan.cache.players)
    .then(exitWithCode(0), exitWithCode(1));
};

function clearPlayers(players) {
  var resolved  = utils.promise.resolve(),
      playerIds = Object.keys(players || {});

  if(playerIds.length === 0){
    return resolved;
  }

  return Object.keys(players).reduce(function(previous, current){
    return previous.then(players[current].clear);
  }, resolved);
}

function exitWithCode(exitCode) {
  return function() {
    process.exit(exitCode);

    return utils.promise.resolve();
  }
}
