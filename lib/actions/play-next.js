module.exports.create = create;

function create(players, ui, services, eventBus) {
  var instance = {
    name: 'playNext',
    events: [{
      name: 'playNext',
      states: ['online'],
      action: action
    }]
  };

  return instance;

  function action() {
    var device = this;

    services.next().then(function(nextService) {
      return device.handle('play', nextService);
    });
  }
}
