var utils    = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger   = utils.logger('avoider-routes');

module.exports = routes;

function routes(app, states, settings, eventBus) {
  var currentAvoid = { isAvoiding: false };

  app.get('/', index);
  app.get('/state.json', state);
  app.post('/', avoid);
  app.delete('/', cancel);

  app.use(settingsRoutes(settings));

  // Keep track of avoider state
  eventBus.on('avoider', function (msg) {
    currentAvoid = msg;
  });

  return app;

  function index(req, res) {
    res.render(
      __dirname+'/views/index'
    );
  }

  function state(req, res) {
    var isAvoiding = (states.state === 'avoiding'),
        json = currentAvoid;

    res.json(currentAvoid);
  }

  function avoid(req, res) {
    settings.get().then(function(avoidSettings) {
      res.send(200);
      states.handle('startAvoiding', avoidSettings);
    }).then(null, utils.failedPromiseHandler(logger));
  }

  function cancel(req, res) {
    states.handle('stopAvoiding');
    res.send(200);
  }
}
