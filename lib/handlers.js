var utils = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports.create = function(players, services) {
 return {
    standby:    standby,
    playing:    require(__dirname+'/handlers/playing')(players, services),
    announcing: require(__dirname+'/handlers/announcing')(players, services),
    avoiding:   require(__dirname+'/handlers/avoiding')(players, services),
  };

  function standby() {
    players.main.clear();
    players.avoider.clear();
    players.announcer.clear();
    services.change(null);
  }
}
