module.exports.create = create;

function create(radiodan) {
  var device = radiodan.device.get();

  return {
    bindToState: bindToState
  };

  function bindToState(state) {
    state.on('shutdown', function() {
      //emit over eventBus?
      device.shutdown();
    });
  }
}
