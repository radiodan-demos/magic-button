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

      this.emit('msg', 'avoider', {
        isAvoiding: true,
        from: avoidedStationId, to: settings.stationId
      });
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
}
