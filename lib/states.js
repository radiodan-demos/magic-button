var machina = require('machina'),
    utils   = require('radiodan-client').utils,
    logger  = utils.logger(__filename),
    players = setupPlayers();

module.exports = createMachina();

function createMachina() {
  return new machina.Fsm({
    initialState: 'playing',
    states: {
      'standby': stateFor('standby'),
      'playing': stateFor('playing'),
      'avoiding': stateFor('avoiding'),
      'standbyAnnouncing': stateFor('standbyAnnouncing'),
      'playingAnouncing': stateFor('playingAnnouncing'),
      'avoidingAnnouncing': stateFor('avoidingAnnouncing'),
    }
  });
}

function stateFor(stateName) {
  var fileName = stateName.replace('A', '-a');
  return require(__dirname+'/states/'+fileName)(players, services);
}
