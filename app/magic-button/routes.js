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
    device.handle('magic');
    res.sendStatus(202);
  }
}
