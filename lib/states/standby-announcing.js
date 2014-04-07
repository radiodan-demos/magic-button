var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(handlers) {
  return {
    'standby': function() {
      //speak 'standby'
      handlers.standby();
      handlers.announcing.announce('standby');
    },
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.emit('msg', 'power', { isOn: true });
      this.transition('playingAnnouncing');
      this.handle('startPlaying', service);
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
