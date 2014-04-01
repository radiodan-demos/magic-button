var utils    = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger   = utils.logger(__filename);

module.exports = routes;

function routes(app, states, Settings) {
  var settings = Settings.build(
        'announcer',
        { speak: false, announcer: 'marvin' }
      );

  app.get('/', index);
  app.get('/state.json', state);
  app.post('/', announce);
  app.delete('/', cancel);

  app.use(settingsRoutes(settings));

  return app;

  function index(req, res) {
    res.json({page: 'Announcer'});
  }

  function state(req, res) {
    res.json({
      isAnnouncing: (states.state === 'announcing')
    });
  }

  function announce(req, res) {
    settings.get().then(function(settings) {
      states.handle('startAnnouncing', settings);
      res.redirect('./');
    }).then(null, utils.failedPromiseHandler(logger));
  }

  function cancel(req, res) {
    states.handle('stopAnnouncing');
    res.redirect('./');
  }
}
