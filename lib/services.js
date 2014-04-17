var utils       = require('radiodan-client').utils,
    logger      = utils.logger(__filename),
    BBCServices = require('./services/bbc-services'),
    MyMusic     = require('./services/my-music');

module.exports.create = create;

function create(eventBus, radiodan, settings) {
  var instance = {},
      history  = [],
      currentServiceId;

  instance.bbc     = BBCServices.create().connect();
  instance.myMusic = MyMusic.create(eventBus);

  instance.get          = get;
  instance.programmeFor = fetchMetaData;
  instance.change       = change;
  instance.all          = allServices;
  instance.next         = nextService;
  instance.revert       = revert;

  instance.current = function () { return currentServiceId; };

  function change(id) {
    var metadata;

    currentServiceId = id;
    metadata = fetchMetaData(currentServiceId);

    eventBus.emit('service.id', currentServiceId);
    eventBus.emit('service.changed', metadata);

    history.push(id);
  }

  function nextService() {
    return settings.get().then(function(setData) {
      var preferred    = setData.preferredServices || [],
          currentIndex = preferred.indexOf(currentServiceId),
          nextIndex    = currentIndex + 1,
          nextServiceId;

      switch(true) {
        case (currentIndex == -1):
        case (nextIndex >= preferred.length):
          nextServiceId = preferred[0];
          break;
        default:
         nextServiceId = preferred[nextIndex];
      }

      logger.info(nextServiceId, currentIndex);
      return nextServiceId;
    }).then(null, utils.failedPromiseHandler(logger));
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
        var myMusic = instance.myMusic.station();

        return stations.concat(myMusic);
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
      return instance.myMusic.metadata();
    } else {
      return instance.bbc.get(id);
    }
  }

  return instance;
}
