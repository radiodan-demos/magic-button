var utils    = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger   = utils.logger('avoider-routes');

module.exports = routes;

function routes(app, device, settings, eventBus) {
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
    res.json({page: 'Avoider'});
  }

  function state(req, res) {
    var isAvoiding = (device._priorAction == 'online.startAvoiding'),
        stateObj = {isAvoiding: isAvoiding};

    res.json(stateObj);
  }

  function avoid(req, res) {
    settings.get().then(function(avoidSettings) {
      res.send(200);
      device.handle('startAvoiding', avoidSettings);
    })
    .then(function() {
      // listen for station switching, cancel avoid
      var listener = device.on('*', function(_, handled) {
        switch(handled.inputType) {
          case 'play':
            logger.debug('cancel avoid, new station playing');
            device.handle('stopAvoiding');
            listener.off();
            break;
          case 'stopAvoiding':
            logger.debug('avoiding finished, clear listener');
            listener.off();
            break;
        }
      });
    })
    .then(null, utils.failedPromiseHandler(logger));
  }

  function cancel(req, res) {
    device.handle('stopAvoiding');
    res.send(200);
  }
}
