var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function() {
  return {
    'startAvoiding': function(avoidSettings) {
      logger.warn('avoidSettings', avoidSettings);
      this.handlers.avoiding.start(avoidSettings);
    },
    'stopAvoiding': function() {
      var service = this.handlers.avoiding.stop();
      logger.info('service', service);

      this.transition('playing');
      this.handle('startPlaying', service);
    },
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.handlers.avoiding.stop();
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
