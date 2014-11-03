/*
 * Current state of magic button radio.
 * Possible states:
 *  standby
 *  online
 *  shutdown
 */
var machina = require('machina'),
    utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

function buildState(actions) {
  var config, state;

  actions = actions || {};
  config = {
    initialState: 'standby',
    states: {
      'standby': utils.mergeObjects({
        'power': 'online',
        'shutdown': 'shutdown',
        'restart': 'restart'
      }, actions.standby),
      'online': utils.mergeObjects({
        'standby': 'standby',
        'shutdown': 'shutdown',
        'restart': 'restart'
      }, actions.online),
      'shutdown': utils.mergeObjects({
      }, actions.shutdown),
      'restart': utils.mergeObjects({
      }, actions.shutdown)
    }
  };

  state = machina().Fsm.extend(config);

  return state;
}

function create(actions) {
  var State = buildState(actions);

  return new State();
}

module.exports.create = create;
