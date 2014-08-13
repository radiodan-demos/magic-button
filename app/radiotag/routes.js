var radiotag = require('radiotag.js'),
    utils    = require('radiodan-client').utils,
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
    settings.get()
      .then(function (settings) {
        var service     = services.programmeFor(services.current()),
            stationId   = service ? service.dabId : null,
            uri         = radiotag.utils.getUri(settings.tagServer),
            accessToken = settings.accessToken;

        if (stationId) {
          radiotag.tag(stationId, uri, accessToken, done);
        } else {
          done(new Error('No service or service has no dab id'));
        }

        function done(error, tag) {
          error ? res.status(500).send(error) 
                : res.status(200).send(tag);
        }
      })
      .then(null, utils.failedPromiseHandler(logger));
  }

}
