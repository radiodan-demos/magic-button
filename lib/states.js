var logger = require("radiodan-client").utils.logger(__filename),
    uuid   = require("radiodan-client").utils.uuid;

module.exports.create = function (config, radiodan, playlists, eventBus) {
  var instance      = {},
      configPlayers = config.players || [],
      players       = {},
      states        = {},
      stack         = [];

  function currentState() {
    return stack[stack.length - 1];
  }

  configPlayers.forEach(function (item) {
    var id = item.id;
    players[id] = radiodan.player.get(id);
  });

  instance.create = function (stateDef) {
    var id = (stateDef.name ? stateDef.name + '.' : '') + uuid(),
        state = {
          id: id,
          enter: function () {
            instance.enter(id);
          },
          exit: function () {
            instance.exit(id);
          }
        };
    instance.register(state.id, stateDef);
    return state;
  }

  instance.register = function (name, stateDef) {
    states[name] = stateDef;
  };

  instance.enter = function (name) {
    var state = states[name];
    stack.push(name);
    executeStateFn(states[name], 'enter');
  };

  instance.exit = function (name) {
    if (currentState() === name) {
      executeStateFn(states[name], 'exit');
      stack.pop();
    } else {
      logger.warn('Cannot exit state "%s" becaue in state "%s"', name, currentState());
    }
  };

  function executeStateFn(state, fnName) {
    try {
      return state[fnName](state, players, playlists, eventBus.emit);
    } catch (e) {
      logger.error('Error executing state ', state.id, fnName, e.stack);
    }
  }

  return instance;
};
