var radiodanClient = require("radiodan-client"),
    utils          = radiodanClient.utils,
    radiodan       = radiodanClient.create(),
    settingsRoutes = require("../settings/routes"),
    logger         = utils.logger('radio-routes');

module.exports = routes;

function routes(app, eventBus, device, services, settings) {
  var audio = radiodan.audio.get('default');

  app.post('/button', function (req, res) {
    device.handle('power');
    res.send(200);
  })

  app.get('/next', function(req, res) {
    device.handle('playNext');
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
      power: { isOn: (device.state != 'standby') }
    });
  });
  app.put('/power', start); // tee hee
  app.post('/power', start);
  app.delete('/power', standby);

  app.post('/shutdown', function (req, res) {
    device.handle('shutdown');
    res.json({ shutdown: true });
  });

  app.post('/restart', function (req, res) {
    device.handle('restart');
    res.json({ shutdown: true });
  });

  function getState(req, res) {
    var current, state, logLevel;

    logLevel = utils.logger.logLevel ? utils.logger.logLevel() : null;

    if(device.state != 'standby') {
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
          logger.info('Responding with state', device.state);

          state = {
            power   : { isOn: (device.state != 'standby') },
            current : current,
            audio   : { volume  : audioStatus.volume },
            avoider : { isAvoiding: false },
            services: stations,
            debug   : {
              logLevel: logLevel
            }
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
      device.handle('play', settings.serviceId);
      res.send(200);
    });
  }

  function standby(req, res) {
    device.handle('standby');
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

    device.handle('play', id);
    res.send(200);
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
