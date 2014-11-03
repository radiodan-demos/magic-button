module.exports.create = create;

function create(players, ui, services, eventBus) {
  var instance = {
    id: 'playNext',
    states: ['online'],
    action: action
  };

  return instance;

  function action() {
    services.next().then(function(nextService) {
      return this.handle('play', nextService);
    });
  }
}
