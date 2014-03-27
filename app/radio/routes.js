var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, eventBus, radiodan, states, services, bbcServices, power) {

  var audio  = radiodan.audio.get('default');

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
      data = bbcServices.get(current);
    }
    res.json(200, data);
  });
  app.get('/services', listServices);

  function listServices(req, res) {
    bbcServices.ready
               .then(function () {
                  res.json(bbcServices.get());
               });
  }

  /*
    Change state
  */
  app.put('/power', start); // tee hee
  app.post('/power', start);
  app.delete('/power', standby);

  function start(req, res) {
    power.turnOn();
    res.send(200);
  }

  function standby(req, res) {
    power.turnOff();
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

  function createStateForServiceId(id) {
    var state = states.create({
      name: 'changeService',
      enter: function (state, players, services, emit) {
        players.main.add({ clear: true, playlist: services.get(id) })
              .then(players.main.play);
        services.change(id);
      },
      exit: function (state, players, services, emit) {
        players.main.stop();
      }
    });
    return state;
  }

  function changeService(req, res) {
    var id = req.params.id;
    var state = createStateForServiceId(id);
    state.enter();
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

    return app;
}
