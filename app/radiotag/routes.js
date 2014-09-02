var utils    = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger   = utils.logger('radiotag-routes');

module.exports = routes;

function routes(app, states, services, settings, eventBus) {

  app.get('/state.json', state);
  app.put('/tag', tag);

  app.use(settingsRoutes(settings));

  // Keep track of avoider state
  // eventBus.on('avoider', function (msg) {
  //   currentAvoid = msg;
  // });

  return app;

  function state(req, res) {
    settings.get()
      .then(function (settings) {
        res.json(settings);
      })
      .then(null, utils.failedPromiseHandler(logger));
  }

  function tag(req, res) {
    states.handle('magicButton');
    res.status(200).end();
  }

}
