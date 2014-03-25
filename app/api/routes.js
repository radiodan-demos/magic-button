var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, eventBus, radiodan, states) {

  var audio  = radiodan.audio.get('default'),
      player = radiodan.player.get('main');

  /*
    /volume/value/60
    /volume/diff/-10
  */
  app.get('/volume', getVolume);
  app.post('/volume/:action/:value', changeVolume);

  /*
    /radio/service/radio1
  */
  app.post('/radio/service/:id', changeService);

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

  function registerStateForServiceId(id) {
    var stateId = 'radio-' + id;
    states.register(stateId, {
      enter: function (players, services) {
        players.main.add({ clear: true, playlist: services.get(id) })
              .then(players.main.play);
        services.change(id);
      },
      exit: function (players, services) {
        players.main.stop();
        // services.change(null);
      }
    });
    return stateId;
  }

  function changeService(req, res) {
    var id = req.params.id;
    var stateId = registerStateForServiceId(id);
    //eventBus.emit('service.change', id, player);
    states.enter(stateId);
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

  // var avoidPlayer    = radiodan.player.get("avoider"),
  //     mainPlayer     = radiodan.player.get("main"),
  //     announcePlayer = radiodan.player.get("announcer"),
  //     audio          = radiodan.audio.get("default"),
  //     currentServiceId;

  //   app.get("/playing", playService);

  //   // Broadcast along event stream
  //   bbcServices.on('nowPlaying', function (service, data) {
  //     eventStream.send(data, 'nowPlaying');
  //   });

  //   function playService(req, res) {
  //     var id  = req.query.id,
  //         service = bbcServices.get(id),
  //         url;

  //     if (service) {
  //       url = service.audioStreams[0].url;
  //     }

  //     if (url) {
  //       mainPlayer.clear();
  //       mainPlayer.add({ playlist: [url] });
  //       mainPlayer.play();

  //       currentServiceId = id;
  //     }

  //     res.redirect('back');
  //   };

    return app;
}
