var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, services) {
  var settings = {}, avoidedStationId;

  return {
    'startAvoiding': function(avoidSettings) {
      var self = this, avoidTopic, avoidingEvent;

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
        self.handle('stopAvoiding');
      });

      var message = {
        isAvoiding: true,
        from: avoidedStationId, to: settings.stationId
      };

      if (times) {
        message.start = times.start.toISOString();
        message.end   = times.end.toISOString();
      }

      this.emit('msg', 'avoider', message);
    },
    'stopAvoiding': function(restart) {
      logger.info('stopAvoiding');
      restart = restart || avoidedStationId;

      players.avoider.clear();

      if(restart) {
        delete avoidedStationId;

        this.emit('msg', 'avoider', {
          isAvoiding: false,
          from: settings.stationId, to: restart
        });

        this.transition('playing');
        this.handle('startPlaying', restart);
      }
    },
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.handle('stopAvoiding', service);
    },
    'standby': function() {
      logger.info('standby');
      this.handle('stopAvoiding');
      this.transition('standby');
      this.handle('standby');
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };

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
