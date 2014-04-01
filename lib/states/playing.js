var utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename);

module.exports = function(players, services) {
  return {
    'startPlaying': function(service) {
      logger.info('startPlaying');
      players.main.add({
        clear: true,
        playlist: [services.get(service)]
      })
      .then(players.main.play)
      .then(function(){
        services.change(service);
      });
    },
    'stopPlaying': function() {
      logger.info('stopPlaying');
      players.main.clear().then(function(){
        this.emit('msg', 'stopped');
        this.transition('standby');
      });
    },
    'startPlayingAndAnnouncing': function(service) {
      logger.info('startPlayingAndAnnouncing');
      this.handle('startPlaying', service);
      this.transition('playingAnnouncing');
      this.handle('startAnnouncing');
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
    '*': function(payload) {
      logger.warn('unknown', payload);
      this.emit('error', new Error('Unhandled', payload));
    }
  };
}
