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
    logger     = Radiodan.utils.logger();

module.exports.create = create;

function create(services, eventBus) {
  var radiodan, players, physicalUI, actions, state, shutdown, gracefulExit;

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
  logger.debug('bind shutdown to state');
  shutdown.bindToState(state);

  // graceful shutdown of players when process exits
  if(process.env.NODE_ENV != 'test') {
    logger.debug('setup graceful shutdown');
    gracefulExit = require('./graceful-exit')(radiodan);
    process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);
  }

  return state;
}
