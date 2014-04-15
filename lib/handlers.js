var utils = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports.create = function(players, ui, services, state) {
  return {
    power:      require('./handlers/power')(
                  players, ui, services, state
                ),
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
}
