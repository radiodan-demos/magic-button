var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function() {
  return {
    'standby': function() {
      this.handlers.standby();
      this.emit('msg', 'power', { isOn: false });
      //speak 'standby'
      this.handlers.announcing.announce('standby');
    },
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.emit('msg', 'power', { isOn: true });
      this.transition('playingAnnouncing');
      this.handle('startPlaying', service);
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
