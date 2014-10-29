/*
 * TODO: Nothing here works yet
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
    Radiodan   = require('radiodan-client');

module.exports.create = create;

function create(services, eventBus) {
  var radiodan, players, physicalUI, actions, state, shutdown;

  radiodan = Radiodan.create();

  // create the objects that represent device internals
  players    = Players.create(radiodan);
  physicalUI = PhysicalUi.create(radiodan);
  shutdown   = Shutdown.create(radiodan)

  // build actions that manipulate internals
  actions = Action.create(
    players.objects, physicalUI.objects, services, eventBus
  );

  // assign actions to state machine
  state = State.create(actions.export());

  // player state changes emitted over eventbus
  players.bindToEventBus(eventBus);

  // allow physical ui interactions to effect state
  physicalUI.bindToState(state);

  // shutdown device when state is triggered
  shutdown.bindToState(state);

  return state;
}
