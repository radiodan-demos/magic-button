var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, eventBus, radiodan, states) {

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
  app.post('/radio/service/:id', changeService);

  /*
    Change state
  */
  app.post('/radio/power', start);
  app.delete('/radio/power', standby);

  var powerOn = function (states, players, services, emit) {
    emit('power.on');
    players.main.add({
      clear: true,
      playlist: services.get('6music')
    }).then(players.main.play);
  };

  var powerOff = function (states, players, services, emit) {
      emit('power.off');
      players.main.stop();
      players.avoid.stop();
      players.speak.stop();
    };

  function start(req, res) {
    states.create({
      name: 'powerOn',
      enter: powerOn,
      exit:  powerOff
    }).enter();

    res.send(200);
  }

  function standby(req, res) {
    states.create({
      name: 'powerOff',
      enter: powerOff,
      exit:  function () {}
    }).enter();

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
