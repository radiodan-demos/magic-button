module.exports.create = create;

function create(radiodan) {
  var audio = radiodan.audio.get('default');

  return {
    object: audio,
    bindToEventBus: bindToEventBus
  };

  function bindToEventBus(eventBus){
    audio.on('volume', function (volume) {
      eventBus.emit('audio', { volume: volume.value });
    });
  }
}
