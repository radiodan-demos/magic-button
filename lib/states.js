var machina  = require('machina')(),
    utils    = require('radiodan-client').utils,
    Handlers = require(__dirname+'/handlers'),
    logger   = utils.logger(__filename);

module.exports = { create: create };

function create(config, radiodan, playlists, eventBus) {
  var configPlayers = config.players || [],
      players,
      handlers,
      instance;

  players = setupPlayers(configPlayers);

  instance = createMachina();
  handlers = Handlers.create(players, playlists, instance);
  instance.handlers = handlers;

  bindStateToEventBus(instance, eventBus);

  return instance;

  function createMachina() {
    return new machina.Fsm({
      initialState: 'standby',
       states: {
         'standby':  stateFor('standby'),
         'playing':  stateFor('playing'),
         'avoiding': stateFor('avoiding'),
         'standbyAnnouncing':  stateFor('standbyAnnouncing'),
         'playingAnnouncing':  stateFor('playingAnnouncing'),
         'avoidingAnnouncing': stateFor('avoidingAnnouncing')
       }
    });
  }

  function stateFor(stateName) {
    var fileName = stateName.replace('A', '-a');
    return require(__dirname+'/states/'+fileName)();
  }

  function bindStateToEventBus(instance, eventbus) {
   //emit things on bus when machina emits messages
   instance.on('msg', function(eventName, data){
     eventBus.emit(eventName, data);
   });
  }

  function setupPlayers(configPlayers) {
    var players = {},
        randomPlayers = ['avoider', 'main'];

    configPlayers.forEach(function(item) {
      var id = item.id,
          player;

      player = radiodan.player.get(id);

      player.updateDatabase();

      if(randomPlayers.indexOf(id) > -1) {
        player.random({value: true})
          .then(function() {
            player.repeat({value: true});
          });
      }

      player.on('player', function(player) {
        var msg = {
          playerId: id,
        player: player
        };

        eventBus.emit('player', msg);
      });

      player.on('playlist', function(playlist) {
        var msg = {
          playerId: id,
          playlist: playlist
        };

        eventBus.emit('playlist', msg);
      });

      players[id] = player;
    });


    return players;
  }
}
