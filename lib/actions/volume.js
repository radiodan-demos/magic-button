var utils  = require('radiodan-client').utils;

module.exports.create = create;

function create(players, ui, audio, services, eventBus) {
  var instance = {
    name: 'volume',
    events: [{
      name: 'volume',
      states: ['online'],
      action: action
    }]
  };

  return instance;

  function action(params) {
    audio.volume(params);
  }
}
