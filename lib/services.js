var utils       = require('radiodan-client').utils,
    BBCServices = require('./services/bbc-services'),
    MyMusic     = require('./services/my-music');

module.exports.create = create;

function create(eventBus, radiodan) {
  var instance = {},
      history  = [],
      currentServiceId;

  instance.bbc     = BBCServices.create().connect();
  instance.myMusic = MyMusic.create(eventBus);

  instance.get     = get;
  instance.change  = change;
  instance.all     = allServices;

  instance.current = function () { return currentServiceId; };

  function change(id) {
    currentServiceId = id;
    fetchMetaData(currentServiceId).then(function(metadata) {
      eventBus.emit('service.changed', metadata);
    });
    history.push(id);
  }

  function revert() {
    var last = history.pop();
    if (last) {
      change(last);
    }
  }

  function allServices() {
    return instance.bbc.ready
      .then(instance.bbc.stations)
      .then(function(stations) {
        var all = stations;
        all.push(instance.myMusic.station());

        return all;
    });
  }

  function get(id) {
    if(id === 'my-music') {
      return instance.myMusic.playlist();
    } else {
      return getBBCPlaylist(id);
    }
  }

  function getBBCPlaylist(id) {
    var service = instance.bbc.get(id),
        playlist = [];

    if (service && service.audioStreams && service.audioStreams[0]) {
      playlist.push(service.audioStreams[0].url);
    }

    return playlist;
  }

  function fetchMetaData(id) {
    if(id === 'my-music') {
      return utils.promise.resolve(instance.myMusic.metadata());
    } else {
      return utils.promise.resolve(instance.bbc.get(id));
    }
  }

  return instance;
}
