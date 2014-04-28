var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function() {
  return {
    'startAnnouncing': function(settings) {
      logger.info('startAnnouncing');

      this.handlers.announcing.start('avoider');
    },
    'stopAnnouncing': function(){
      logger.info('stopAnnouncing');
      var self = this;

      this.handlers.announcing.stop().then(function(msg) {
        self.transition('avoiding');
      });
    },
    'startAvoiding': function(settings){
      logger.info('startAvoiding');
      this.handlers.avoiding.start(settings);
      this.handle('startAnnouncing');
    },
    'stopAvoiding': function(){
      logger.info('stopAvoiding');
      service = this.handlers.avoiding.stop();
      this.handle('startPlaying', service);
    },
    'startPlaying': function(service){
      logger.info('startPlaying', service);
      this.handlers.avoiding.stop();
      this.transition('playingAnnouncing');
      this.handle('startPlaying', service);
    },
    'standby': function() {
      logger.info('standby');
      this.handlers.avoiding.stop();
      this.transition('standbyAnnouncing');
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
