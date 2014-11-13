module.exports.create = create;

function create(radiodan) {
  var audio = radiodan.audio.get('default');

  return {
    audio: audio,
    bindToState: bindToState
  };

  function bindToState(state) {
  }
}
