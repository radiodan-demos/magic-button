var machina  = require('machina')(),
    utils    = require('radiodan-client').utils,
    Handlers = require(__dirname+'/handlers'),
    logger   = utils.logger(__filename);

module.exports = { create: create };

function create(config, radiodan, playlists, eventBus) {
  var configPlayers = config.players || [],
      players = {},
      handlers,
      instance;

  configPlayers.forEach(function(item) {
    var id = item.id;

    players[id] = radiodan.player.get(id);
    players[id].on('player', function(player) {
      var msg = {
        playerId: id,
        player: player
      };

      eventBus.emit('player', msg);
    });

    players[id].on('playlist', function(playlist) {
      var msg = {
        playerId: id,
        playlist: playlist
      };

      eventBus.emit('playlist', msg);
    });
  });

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
}
