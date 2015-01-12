/*
 * Instantiation object of action register and all available commands
 */

var fs             = require('fs'),
    ActionRegister = require(__dirname + '/actions/register'),
    actionsPath    = __dirname + '/actions/';

function create(players, ui, audio, services, eventBus, device) {
  var register    = ActionRegister.create(),
      actionNames = fs.readdirSync(actionsPath);

  actionNames.forEach(function(actionFile) {
    if(/\.js$/.test(actionFile) && actionFile != 'register.js') {
      var Action = require(actionsPath + actionFile),
          action = Action.create(players, ui, audio, services, eventBus, device);

      register.register(action);
    }
  });

  return register;
}

module.exports.create = create;
