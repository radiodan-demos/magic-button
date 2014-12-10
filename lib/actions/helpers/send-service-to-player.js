module.exports = function sendServiceToPlayer(playlist, player) {
  var type = playlist.type,
      params = {
        clear: true,
        playlist: [ playlist.value ]
      };

  if (type === 'playlist') {
    return player.load(params);
  } else {
    return player.add(params);
  }
};