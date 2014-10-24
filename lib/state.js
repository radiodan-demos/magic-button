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
      'standby': {
        'power': 'online',
        'shutdown': 'shutdown',
      },
      'online': utils.mergeObjects({
        _onEnter: function() {
          // start playing
        },
        'standby': 'standby',
        'shutdown': 'shutdown',
      }, actions),
      'shutdown': {
        _onEnter: function() {
          // shut it down
        }
      }
    }
  };

  return machina().Fsm.extend(config);
}

function create(actions) {
  var State = buildState(actions);

  return new State();
}

module.exports.create = create;
