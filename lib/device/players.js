/*
 * This is the canonical source of player objects in the
 * Magic Button ecosystem.
 */

module.exports.create = create;

function create(radiodan) {
  var players = {};

  // create players
  players.main      = radiodan.player.get('main');
  players.avoider   = radiodan.player.get('avoider');
  players.announcer = radiodan.player.get('announcer');

  // setup operation
  updateDatabase([players.main, players.avoider, players.announcer]);
  setRandomPlay([players.main, players.avoider]);

  return { objects: players, bindToEventBus: bindToEventBus };

  function updateDatabase(players){
    players.forEach(function(player) {
      player.updateDatabase();
    });
  }

  function setRandomPlay(players){
    players.forEach(function(player) {
      player.random({value: true})
        .then(function() {
          player.repeat({value: true});
        });
    });
  }

  function bindToEventBus(eventBus){
    Object.keys(players).forEach(function(playerId) {
      var player = players[playerId];

      player.on('player', function(playerData) {
        var msg = {
          playerId: playerId,
          player: playerData
        };

        eventBus.emit('player', msg);
      });

      player.on('playlist', function(playlistData) {
        var msg = {
          playerId: playerId,
          playlist: playlistData
        };

        eventBus.emit('playlist', msg);
      });
    });
  }
}
