module.exports.create = create;

function create(eventBus, radiodan, bbcServices) {
  var instance = {},
      currentServiceId;

  instance.get = getPlaylist;
  instance.change = change;
  instance.current = function () { return currentServiceId; };

  function change(id) {
    currentServiceId = id;
    eventBus.emit('service.changed', id);
  }

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
