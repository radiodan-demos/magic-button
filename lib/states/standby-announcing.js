var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, services) {
  return {
    'standby': function() {
      this.transition('standby');
      this.handle('standby');
      this.transition('standbyAnnouncing');
    },
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.transition('playingAnnouncing');
      this.handle('startPlaying', service);
      this.emit('msg', 'power', { isOn: true });
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
