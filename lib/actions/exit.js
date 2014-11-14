module.exports.create = create;

function create(players, ui, audio, services, eventBus) {
  var instance = {
    name: 'exit',
    events: [{
      name: 'exit',
      states: ['online'],
      action: emitAndPowerDown
    },
    {
      name: 'exit',
      states: ['standby'],
      action: emit
    }]
  };

  return instance;

  function emitAndPowerDown() {
    eventBus.emit('exit');
    this.handle('power');
  }

  function emit() {
    eventBus.emit('exit');
  }
}
