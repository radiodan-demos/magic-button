var fs             = require('fs'),
    utils          = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger         = utils.logger('magic-button-routes');

module.exports = routes;

function routes(app, device, settings) {
  app.get('/', index);
  app.post('/', push);

  app.use(settingsRoutes(settings));

  return app;

  function index(req, res) {
    res.json({page: 'MagicButton'});
  }

  function push(req, res) {
    settings.get().then(function(magicButton) {
      switch(magicButton.action) {
        case "announcer":
          logger.info("announcing");
          device.handle("toggleAnnouncing");
          break;
        case "avoider":
          logger.info("avoiding");
          device.handle("toggleAvoiding");
          break;
        default:
          logger.debug("No action assigned for", magicButton.action);
      }
    });
  }
}
