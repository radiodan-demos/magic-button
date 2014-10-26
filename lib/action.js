/*
 * Instantiation object of action register and all available commands
 */

var ActionRegister   = require('actions/register'),
    availableActions = require('../config/actions.json');

function create(radiodan, settings, eventBus) {
  var register    = ActionRegister.create(radiodan, settings, eventBus),
      actionNames = Object.keys(availableActions);

  availableActions.forEach(function(actionName) {
    // filename = lib/actions/$name
    // value = states at which action attaches
    register.register(actionName, availableActions[actionName]);
  });

  return register;
}

module.exports.create = create;
