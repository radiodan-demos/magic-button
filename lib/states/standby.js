var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, services) {
  return {
    'startPlaying': function(service) {
      logger.info('startPlaying');
      this.transition('playing');
      this.handle('startPlaying', service);
      this.emit('msg', 'power', { isOn: true });
    },
    'startPlayingAndAnnouncing': function(service) {
      logger.info('startPlayingAndAnnouncing');
      this.transition('playingAnnouncing');
      this.handle('startPlayingAndAnnouncing', service);
      this.emit('msg', 'power', { isOn: true });
    },
    'standby': function(){
      players.main.clear();
      players.avoider.clear();
      players.announcer.clear();
      services.change(null);
      this.emit('msg', 'power', { isOn: false });
    },
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
