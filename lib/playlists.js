var bbcServices = require("./bbc-services").create().connect();

module.exports.create = create;

function create(eventBus, radiodan) {
  var instance = {},
      players  = {};

  eventBus.on('service.change', function (serviceId, playerId) {
    var player = radiodan.player.get(playerId),
        playlist = getPlaylist(serviceId);

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
