var utils = require("radiodan-client").utils,
    settingsRoutes = require("../settings/routes"),
    logger = utils.logger('radio-routes');

module.exports = routes;

function routes(app, eventBus, radiodan, states, services, settings) {

  var audio    = radiodan.audio.get('default');

  app.get('/next', function(req, res) {
    states.handle('playNextService');
    res.send(200);
  });

  /*
    A big ball of state
  */
  app.get('/state.json', getState);

  /*
    /volume/value/60
    /volume/diff/-10
  */
  app.get('/volume', getVolume);
  app.post('/volume/:action/:value', changeVolume);

  /*
    /radio/service/radio1
  */
  app.post('/service/:id', changeService);
  app.get('/service', function (req, res) {
    var current = services.current(),
        data = {};
    if (current) {
      data = services.get(current);
    }
    res.json(200, data);
  });

  app.get('/services', listServices);

  function listServices(req, res) {
    services.all()
      .then(function (services) {
        res.json(services);
      });
  }

  /*
    Change state
  */
  app.get('/power', function (req, res) {
    res.json({
      power: { isOn: (states.state != 'standby') }
    });
  });
  app.put('/power', start); // tee hee
  app.post('/power', start);
  app.delete('/power', standby);

  function getState(req, res) {
    var current, state;

    if(services.current()) {
      var programme = services.programmeFor(services.current());
      current = {
        id: programme.id,
        title: programme.title,
        nowAndNext: programme.nowAndNext,
        nowPlaying: programme.nowPlaying
      };
    } else {
      current = null;
    }

    utils.promise.spread(
      [
        audio.status(),
        services.all()
      ],
      function (audioStatus, stations) {
        logger.info('Stations %s, status:', stations.length, audioStatus);
        try {
          logger.info('Responding with state', states.state);

          state = {
            power   : { isOn: (states.state != 'standby') },
            current : current,
            audio   : { volume  : audioStatus.volume },
            avoider : { isAvoiding: false },
            services: stations
          };
        } catch (err) {
          logger.warn(err);
          state = {};
        }

        res.json(state);
      });
  }

  function start(req, res) {
    settings.get().then(function(settings){
      states.handle('startPlaying', settings.serviceId);
      res.send(200);
    });
  }

  function standby(req, res) {
    states.handle('standby');
    res.send(200);
  }

  function getVolume(req, res) {
    audio.status()
         .then(
          respondWithSuccess(req, res),
          utils.failedPromiseHandler(logger)
         );
  }

  function changeVolume(req, res) {
    var action = req.params.action,
        value  = req.params.value,
        params = {};

    params[action] = value;

    audio.volume(params)
         .then(
            respondWithSuccess(req, res),
            respondWithError(req, res)
          )
         .then(null, utils.failedPromiseHandler(logger));
  }

  function changeService(req, res) {
    var id = req.params.id;

    settings.update({serviceId: id}).then(function() {
      states.handle('startPlaying', id);
      res.send(200);
    });
  }

  function respondWithSuccess(req, res) {
    return function (result) {
      res.json(result);
    };
  }

  function respondWithError(req, res) {
    return function (error) {
      res.json(500, { error: error });
    };
  }

  app.use(settingsRoutes(settings));

  return app;
}
