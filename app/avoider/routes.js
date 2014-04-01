var utils    = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger   = utils.logger(__filename);

module.exports = routes;

function routes(app, states, Settings) {
  var settings = Settings.build(
        'avoider',
        { serviceId: 'radio1', avoidType: 'programme' }
      );

  app.get('/', index);
  app.get("/state.json", state);
  app.post('/', avoid);
  app.delete('/', cancel);

  app.use(settingsRoutes(settings));

  return app;

  function index(req, res) {
    res.render(
      __dirname+'/views/index'
    );
  }

  function state(req, res) {
    res.json({
      isAvoiding: (states.state === 'avoiding')
    });
  }

  function avoid(req, res) {
    settings.get().then(function(avoidSettings) {
      states.handle('startAvoiding', avoidSettings);
      res.redirect('./');
    }).then(null, utils.failedPromiseHandler(logger));
  }

  function cancel(req, res) {
    states.handle('stopAvoiding');
    res.redirect('./');
  }
}
