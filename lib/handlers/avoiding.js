var utils = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports = function(players, services) {
  var settings = {}, avoidedStationId;

  return {
    start: startAvoiding,
    stop:  stopAvoiding,
    settings: settings
  };

  function startAvoiding(avoidSettings, cb) {
    var avoidTopic, avoidingEvent;

    logger.info('startAvoiding');

    settings = avoidSettings;
    avoidedStationId = services.current();
    avoidTopic = (settings.avoidType || topicFromService(avoidedStationId));

    var currentService = services.bbc.get(avoidedStationId);


    if (avoidSettings.avoidType === 'programmes' && currentService.nowAndNext) {
      logger.info('programmes');
      var currentProgramme = currentService.nowAndNext[0];
      var times = startAndEndTimesProgramme(currentProgramme.end);
    } else if (avoidSettings.avoidType === 'tracks') {
      logger.info('tracks');
      var nowPlaying = currentService.nowPlaying;
      if (nowPlaying && nowPlaying.duration) {
        var times = startAndEndTimes(nowPlaying.received, nowPlaying.duration);
      }
    }

    players.main.stop();
    players.avoider
      .add({
        clear: true, playlist: services.get(settings.serviceId)
      })
    .then(players.avoider.play);

    services.change(settings.serviceId);

    avoidingEvent = avoidedStationId + '.' + avoidTopic;
    logger.info('waiting for ', avoidingEvent);

    services.bbc.once(avoidingEvent, function () {
      logger.info('responding to ', avoidingEvent);
      cb();
    });

    var message = {
      isAvoiding: true,
      from: avoidedStationId, to: settings.stationId
    };

    if (times) {
      message.start = times.start.toISOString();
      message.end   = times.end.toISOString();
    }

    return message;
  }

  function stopAvoiding() {
    logger.info('stopAvoiding');

    players.avoider.clear();

    return avoidedStationId;
  }

  function topicFromService(service) {
    var musicServices = ['radio1','1xtra','radio2','radio3','6music'];

    if(musicServices.indexOf(service) > -1) {
      return 'nowPlaying';
    } else {
      return 'nowAndNext';
    }
  }

  function startAndEndTimesProgramme(endDateStr) {
    var endDate = new Date(endDateStr),
        now = new Date(),
        times = null;

    if ( !isNaN(endDate.valueOf()) ) {
      times = {
        start: now,
        end: endDate
      }
    }

    return times;
  }

  function startAndEndTimes(startDateStr, duration) {
    var startDate = new Date(startDateStr),
        times = null,
        endTime,
        endDate;

    if ( duration || !isNaN(startDate.valueOf()) ) {
      endTime = startDate.valueOf() + (duration * 1000);
      endDate = new Date(endTime);
      times = {
        start: startDate,
        end: endDate
      }
    }

    return times;
  }
}
