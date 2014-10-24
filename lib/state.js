/*
 * Current state of magic button radio.
 * Possible states:
 *  standby
 *  online
 *  shutdown
 */
var machina = require('machina'),
    State;

State = machina().Fsm.extend({
  initialState: 'standby',
  states: {
    'standby': {
      'power': transition('online'),
      'shutdown': transition('shutdown'),
    },
    'online': {
      'standby': transition('standby'),
      'shutdown': transition('shutdown')
    },
    'shutdown': {}
  }
});

function transition(state) {
  return function() {
    this.transition(state);
  }
}

function create() {
  return new State();
}

module.exports.create = create;
