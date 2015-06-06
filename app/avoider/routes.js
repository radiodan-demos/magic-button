var utils    = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger   = utils.logger('avoider-routes');

module.exports = routes;

function routes(app, device, settings, eventBus) {
  var currentAvoid = { isAvoiding: false };

  app.get('/', state);
  app.post('/', avoid);
  app.delete('/', cancel);

  app.use(settingsRoutes(settings));

  // Keep track of avoider state
  eventBus.on('avoider', function (msg) {
    currentAvoid = msg;
  });

  return app;

  function state(req, res) {
    var isActive = device.currentMagicAction() == 'avoid';
    res.json({
      isAvoiding: isActive
    });
  }

  function avoid(req, res) {
    device.handle('avoid:start');
    res.send(200);
    // settings.get().then(function(avoidSettings) {
    //   res.send(200);
    //   device.handle('startAvoiding', avoidSettings);
    // })
    // .then(function() {
    //   // listen for station switching, cancel avoid
    //   var listener = device.on('*', function(_, handled) {
    //     switch(handled.inputType) {
    //       case 'play':
    //         logger.debug('cancel avoid, new station playing');
    //         device.handle('stopAvoiding');
    //         listener.off();
    //         break;
    //       case 'stopAvoiding':
    //         logger.debug('avoiding finished, clear listener');
    //         listener.off();
    //         break;
    //     }
    //   });
    // })
    // .then(null, utils.failedPromiseHandler(logger));
  }

  function cancel(req, res) {
    device.handle('avoid:stop');
    res.send(200);
  }
}
