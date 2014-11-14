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
    flashPhysicalUi();
  }

  function restart() {
    this.emit('restart');
    flashPhysicalUi();
  }

  function flashPhysicalUi() {
    // Change to yellow
    ui.RGBLEDs.power.emit({
      emit: true,
      colour: ui.colours.yellow,
      transition: { duration: 200 }
    });
    // Flash yellow
    ui.RGBLEDs.power.emit({
      emit: true,
      colour: ui.colours.black,
      transition: {
        yoyo: true
      }
    });
  }
}
