var utils    = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger   = utils.logger(__filename);

module.exports = routes;

function routes(app, states, Settings) {
  var settings = Settings.build('avoider');

  app.get('/', index);
  app.get('/state.json', state);
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
    var isAvoiding = (states.state === 'avoiding'),
        json = {
          isAvoiding: isAvoiding
        };

    if (isAvoiding) {
      var start = new Date();
      var end = new Date(start.valueOf() + (60 * 5 * 1000));
      json.startTime = start.toISOString();
      json.endTime   = end.toISOString();
    }

    res.json(json);
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
