var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, radiodan, bbcServices) {
  var avoidPlayer    = radiodan.player.get("avoider"),
      mainPlayer     = radiodan.player.get("main"),
      announcePlayer = radiodan.player.get("announcer"),
      currentService;

    app.use("/assets", require("serve-static")(__dirname + "/static"));
    app.get("/playing", playService);
    app.get("/", showIndex);

    function showIndex(req, res) {
      res.render(
        __dirname+"/views/index",
        {
          currentService: currentService,
          services: bbcServices.cache
        }
      );
    }

    function playService(req, res) {
      var id  = req.query.id,
          service = bbcServices.cache[id],
          url;

      if (service && service.streams && service.streams[0]) {
        url = service.streams[0].url;
      }

      if (url) {
        mainPlayer.clear();
        mainPlayer.add({ playlist: [url] });
        mainPlayer.play();

        currentService = service;
      }

      res.redirect('back');
    };

    return app;
}
