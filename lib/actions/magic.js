var logger = require('radiodan-client').utils.logger(__filename);

module.exports.create = create;

function create(players, ui, audio, services, eventBus, device) {
  var instance = {
    name: 'magic',
    settings: 'magic-button',
    events: [{
      name: 'magic',
      states: ['standby', 'online'],
      action: action
    }]
  };

  return instance;

  function action(settings) {
    settings = settings || {};

    switch(settings.action) {
      case 'announcer':
        logger.info('magic: triggering announce action');
        device.handle('announce');
        break;
      // case 'avoider':
      //   logger.info('magic: triggering avoid action');
      //   device.handle('avoid');
      //   break;
      default:
        logger.info('No action assigned for', settings.action);
    }
  };
}
