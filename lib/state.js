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
  var config;

  actions = actions || {};
  config = {
    initialState: 'standby',
    states: {
      'standby': utils.mergeObjects({
        'power': 'online',
        'shutdown': 'shutdown',
      }, actions.standby),
      'online': utils.mergeObjects({
        'standby': 'standby',
        'shutdown': 'shutdown',
      }, actions.online),
      'shutdown': utils.mergeObjects({
        _onEnter: function() {
          // shut it down
        }
      }, actions.shutdown)
    }
  };

  return machina().Fsm.extend(config);
}

function create(actions) {
  var State = buildState(actions);

  return new State();
}

module.exports.create = create;
