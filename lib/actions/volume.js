var utils  = require('radiodan-client').utils;

module.exports.create = create;

function create(players, ui, audio, services, eventBus) {
  var instance = {
    name: 'volume',
    events: [{
      name: 'volume',
      states: ['online'],
      action: action
    },
    {
      name: 'volumeUp',
      states: ['online'],
      action: volumeUp
    },
    {
      name: 'volumeDown',
      states: ['online'],
      action: volumeDown
    }]
  },
  volumeDiff = 5;

  return instance;

  function volumeUp() {
    action({
      diff: volumeDiff
    });
  }

  function volumeDown() {
    action({
      diff: -volumeDiff
    });
  }

  function action(params) {
    audio.volume(params);
  }
}
