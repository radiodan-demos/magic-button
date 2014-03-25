module.exports.create = create;

function create(eventBus, radiodan, bbcServices) {
  var instance = {};

  instance.get = getPlaylist;

  eventBus.on('service.change', function (serviceId, player) {
    var playlist = getPlaylist(serviceId);

    player.clear()
          .then(function () { return player.add({ playlist: playlist }); })
          .then(player.play)
          .then(function () {
            eventBus.emit('service.changed', serviceId, playerId);
          });
  });

  function getPlaylist(id) {
    var service = bbcServices.get(id),
        playlist = [];
    if (service && service.audioStreams && service.audioStreams[0]) {
      playlist.push(service.audioStreams[0].url);
    }

    return playlist;
  }

  return instance;
}
