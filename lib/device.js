/*
 * Magic Button device
 * This is the heart of the magic button system.
 * It creates the main objects that interact in the system:
 *  Audio players
 *  Physical UI
 * It also contains the state and the actions
 * that can be handled in each state
 */

var State      = require('./state'),
    Action     = require('./action'),
    PhysicalUi = require('./device/physical-ui'),
    Players    = require('./device/players'),
    Shutdown   = require('./device/shutdown'),
    Audio      = require('./device/audio'),
    Radiodan   = require('radiodan-client'),
    Promise    = Radiodan.utils.promise,
    logger     = Radiodan.utils.logger();

module.exports.create = create;

function create(services, eventBus, Settings) {
  var instance = {},
      radiodan, players, physicalUI, actions, state, shutdown, gracefulExit;

  radiodan = Radiodan.create();

  // create the objects that represent device internals
  logger.debug('creating radiodan objects');

  players    = Players.create(radiodan);
  physicalUI = PhysicalUi.create(radiodan);
  shutdown   = Shutdown.create(radiodan)
  audio      = Audio.create(radiodan);

  // build actions that manipulate internals
  logger.debug('creating actions');
  actions = Action.create(
    players.objects, physicalUI.objects, audio.object, services, eventBus
  );

  // assign actions to state machine
  logger.debug('assign actions to state machine');
  state = State.create(actions.export());

  // player state changes emitted over eventbus
  logger.debug('bind players to eventbus');
  players.bindToEventBus(eventBus);

  // audio volume changes emitted over eventbus
  logger.debug('bind audio to eventbus');
  audio.bindToEventBus(eventBus);

  // allow physical ui interactions to effect state
  logger.debug('bind physicalUI to eventbus');
  physicalUI.bindToState(state);

  // shutdown device when state is triggered
  logger.debug('bind shutdown to state and eventbus');
  shutdown.bindTo(state, eventBus);

  // graceful shutdown of players when process exits
  if(process.env.NODE_ENV != 'test') {
    logger.debug('setup graceful shutdown');
    gracefulExit = require('./graceful-exit')(radiodan, state);
    process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);
  }

  state.on('*', function() {
    console.log('***', arguments);
  });

  instance.handle = function (targetAction, opts) {
    var action = actions.parse(targetAction);

    if (!action) {
      throw Error('Incorrect action format specified: ', targetAction);
    }

    if ( action.type == 'atomic' ) {
      state.handle(action.name, opts);
    } else if ( action.type == 'magic' ) {
      var ready = Promise.resolve();

      if (action.settings) {
        ready = Settings
                  .get(action.settings)
                  .get();
      }

      ready.then(function (settings) {
        state.handle(action.name + '.' + action.phase, settings);
      });
    }
  };

  return instance;
}
