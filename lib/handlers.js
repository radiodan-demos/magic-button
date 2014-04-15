var utils = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports.create = function(players, ui, services, state) {
  return {
    standby:    standby,
    playing:    require('./handlers/playing')(
                  players, ui, services, state
                ),
    announcing: require('./handlers/announcing')(
                  players, ui, services, state
                ),
    avoiding:   require('./handlers/avoiding')(
                  players, ui, services, state
                ),
  };

  function standby() {
    players.main.clear();
    players.avoider.clear();
    players.announcer.clear();
    services.change(null);
  }
}
