var utils = require("radiodan-client").utils,
    settingsRoutes = require("../settings/routes"),
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, eventBus, radiodan, states, services, Settings) {

  var audio  = radiodan.audio.get('default'),
      settings = Settings.build(
        "radio",
        { serviceId: "radio4", playing: true }
      );

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
      data = services.bbc.get(current);
    }
    res.json(200, data);
  });

  app.get('/services', listServices);

  function listServices(req, res) {
    services.bbc.ready
      .then(function () {
        res.json(services.bbc.get());
      });
  }

  /*
    Change state
  */
  app.put('/power', start); // tee hee
  app.post('/power', start);
  app.delete('/power', standby);

  function getState(req, res) {
    var current, state;

    if(services.current()) {
      var programme = services.bbc.get(services.current());
      current = {
        id: programme.id,
        title: programme.title,
        nowAndNext: programme.nowAndNext
      };
    } else {
      current = null;
    }

    utils.promise.spread(
      [
        audio.status(),
        services.bbc.stations()
      ],
      function (status, stations) {
        logger.info('Stations %s, status:', stations.length, status);
        try {
          logger.info('Responding with state', state);

          state = {
            power   : { isOn: (states.state != 'standby') },
            services: stations,
            current : current,
            audio   : { volume  : status.volume },
            avoider : { isAvoiding: false }
          };
        } catch (err) {
          logger.warn(err);
          state = {};
        }

        res.json(state);
      });
  }

  function start(req, res) {
    states.handle('startPlaying', '6music');
    res.send(200);
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
         .then(function (result) {
          eventBus.emit('audio.volume', result);
          return result;
         })
         .then(
            respondWithSuccess(req, res),
            respondWithError(req, res)
          )
         .then(null, utils.failedPromiseHandler(logger));
  }

  function changeService(req, res) {
    var id = req.params.id;

    states.handle('startPlaying', id);
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
