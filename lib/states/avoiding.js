var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(handlers) {
  var settings = {}, avoidedStationId;

  return {
    'startAvoiding': function(avoidSettings) {
      var self = this,
          emitStop,
          message;

      emitStop = function() {
        self.handle('stopAvoiding');
      };

      message = handlers.avoiding.start(avoidSettings, emitStop);

      this.emit('msg', 'avoider', message);
    },
    'stopAvoiding': function() {
      var service = handlers.avoiding.stop();
      logger.info('service', service);

      this.emit('msg', 'avoider', {
        isAvoiding: false,
        from: handlers.avoiding.settings.stationId, to: service
      });

      this.transition('playing');
      this.handle('startPlaying', service);
    },
    'startPlaying': function(service) {
      logger.info('startPlaying');
      handlers.avoiding.stop();
      this.transition('playing');
      this.handle('startPlaying', service);
    },
    'standby': function() {
      logger.info('standby');
      this.handle('stopAvoiding');
      this.transition('standby');
      this.handle('standby');
    },
    'startAnnouncing': function(settings) {
      logger.info('startAnnouncing');
      this.transition('avoidingAnnouncing');
      this.handle('startAnnouncing', settings);
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
