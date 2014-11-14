module.exports.create = create;

function create(players, ui, audio, services, eventBus) {
  var instance = {
    name: 'shutdown',
    events: [{
      name: 'shutdown',
      states: ['standby', 'online'],
      action: shutdown
    },
    {
      name: 'restart',
      states: ['standby', 'online'],
      action: restart
    }]
  };

  return instance;

  function shutdown() {
    this.emit('shutdown');
  }

  function restart() {
    this.emit('restart');
  }
}
