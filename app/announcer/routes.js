var fs             = require('fs'),
    utils          = require('radiodan-client').utils,
    settingsRoutes = require('../settings/routes'),
    logger         = utils.logger('announcer-routes'),
    announcersPath = __dirname + '/../../audio/';

module.exports = routes;

function routes(app, device, settings) {
  var availableAnnouncers = findAvailableAnnouncers(announcersPath);

  settings.update({available: availableAnnouncers});

  app.get('/', index);
  app.get('/state.json', state);
  app.post('/', announce);
  app.delete('/', cancel);

  app.use(settingsRoutes(settings));

  return app;

  function index(req, res) {
    res.json({page: 'Announcer'});
  }

  function state(req, res) {
    var isAnnouncing = device._priorAction == 'online.startAnnouncing' 
          || device._priorAction == 'standby.startAnnouncing';
    res.json({
      isAnnouncing: isAnnouncing
    });
  }

  function announce(req, res) {
    device.handle('announce:start');
    res.sendStatus(200);
    // settings.get().then(function(settings) {
    //   device.handle('startAnnouncing', settings);
    //   res.send(200);
    // }).then(null, utils.failedPromiseHandler(logger));
  }

  function cancel(req, res) {
    // device.handle('stopAnnouncing');
    device.handle('announce:stop');
    res.send(200);
  }

  function findAvailableAnnouncers(announcersPath) {
    var files = fs.readdirSync(announcersPath),
        announcers = [];

    files.forEach(function(file){
      var path = announcersPath + file,
          stat = fs.statSync(path);

      if (stat && stat.isDirectory()) {
        var package = path + '/package.json',
            announcer;

        try {
          announcer = require(package);
          announcer.path = file;

          announcers.push(announcer);
        } catch(err) {
          logger.warn(err);
        }
      }
    });

    return announcers;
  }
}
