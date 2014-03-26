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

    stateDef.obj = state;

    instance.register(state.id, stateDef);
    return state;
  }

  instance.register = function (name, stateDef) {
    states[name] = stateDef;
  };

  instance.enter = function (name) {
    var state = getState(name),
        current = currentState();

    if (getState(current)) {
      executeStateFn(getState(current), 'exit');
    }

    stack.push(name);
    executeStateFn(state, 'enter');
  };

  instance.exit = function (name) {
    if (currentState() === name) {
      executeStateFn(getState(name), 'exit');
      stack.pop();
    } else {
      logger.warn('Cannot exit state "%s" because in state "%s"', name, currentState());
    }
  };

  function getState(name) {
    return states[name];
  }

  function executeStateFn(stateDef, fnName) {
    try {
      return stateDef[fnName](stateDef.obj, players, playlists, eventBus.emit);
    } catch (e) {
      logger.error('Error executing state ', stateDef.id, fnName, e.stack);
    }
  }

  return instance;
};
