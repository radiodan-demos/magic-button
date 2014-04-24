var machina    = require('machina')(),
    utils      = require('radiodan-client').utils,
    Handlers   = require('./handlers'),
    PhysicalUI = require('./physical-ui'),
    config     = require('../config/radiodan-config.json'),
    logger     = utils.logger(__filename);

module.exports = { create: create };

function create(radiodan, services, eventBus) {
  var configPlayers = config.players || [],
      ui,
      players,
      systemAudio,
      handlers,
      instance;

  players = setupPlayers(configPlayers);

  systemAudio = radiodan.audio.get('default');

  systemAudio.on('volume', function (data) {
    eventBus.emit('audio.volume', { volume: data.value });
  });

  instance = createMachina();
  ui = PhysicalUI.create(radiodan, instance);

  handlers = Handlers.create(players, ui, services, instance);
  instance.handlers = handlers;


  bindStateToEventBus(instance, eventBus);

  // set initial state of standby
  instance.handle('standby');

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

      player.on('player', function(playerData) {
        var msg = {
          playerId: id,
          player: playerData
        };

        eventBus.emit('player', msg);
      });

      player.on('playlist', function(playlistData) {
        var msg = {
          playerId: id,
          playlist: playlistData
        };

        eventBus.emit('playlist', msg);
      });

      players[id] = player;
    });

    return players;
  }
}
