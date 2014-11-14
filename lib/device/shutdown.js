module.exports.create = create;

function create(radiodan) {
  var device = radiodan.device.get();

  return {
    bindTo: bindTo
  };

  function bindTo(state, eventBus) {
    state.on('restart', function() {
      eventBus.emit('shutdown', { type: 'restart' });
      device.restart();
    });

    state.on('shutdown', function() {
      eventBus.emit('shutdown', { type: 'halt' });
      device.shutdown();
    });
  }
}
