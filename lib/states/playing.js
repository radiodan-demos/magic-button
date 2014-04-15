var utils   = require('radiodan-client').utils,
    logger  = utils.logger('states-playing');

module.exports = function() {
  return {
    'startPlaying': function(service) {
      this.handlers.playing.start(service);
    },
    'startAvoiding': function(avoider) {
      logger.info('startAvoiding');
      this.transition('avoiding');
      this.handle('startAvoiding', avoider);
    },
    'startAnnouncing': function(announcer) {
      logger.info('startAnnouncing');
      this.transition('playingAnnouncing');
      this.handle('startAnnouncing', announcer);
    },
    'standby': function() {
      logger.info('standby');
      this.transition('standby');
      this.handle('standby');
    },
    'power': function() {
      logger.info('power');
      this.handle('standby');
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
