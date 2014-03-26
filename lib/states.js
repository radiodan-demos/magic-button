var logger = require("radiodan-client").utils.logger(__filename),
    uuid   = require("radiodan-client").utils.uuid;

module.exports.create = function (config, radiodan, playlists) {
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
    stack.push(name);

    try {
      states[name].enter(players, playlists);
    } catch (e) {
      logger.error('Error executing state enter', name, e.stack);
    }
  };

  instance.exit = function (name) {
    logger.debug('exit for', name);
    if (currentState() === name) {
      logger.debug('is current state');
      states[name].exit(players, playlists);
      logger.debug('exit ran');
      stack.pop();
      logger.debug('state popped');
    } else {
      logger.warn('Cannot exit state "%s" becaue in state "%s"', name, currentState());
    }
  };

  return instance;
};
