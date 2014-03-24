var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, radiodan, eventStream, bbcServices) {
  var avoidPlayer    = radiodan.player.get("avoider"),
      mainPlayer     = radiodan.player.get("main"),
      announcePlayer = radiodan.player.get("announcer"),
      audio          = radiodan.audio.get("default"),
      currentServiceId;

    app.use("/assets", require("serve-static")(__dirname + "/static/"));

    app.get("/playing", playService);
    app.get("/", showIndex);

    // Broadcast along event stream
    bbcServices.on('nowPlaying', function (service, data) {
      eventStream.send(data, 'nowPlaying');
    });

    // Route implementations
    function showIndex(req, res) {
      var currentService = bbcServices.cache[currentServiceId],
          nowPlaying = null,
          nowAndNext = null;

      if (currentService && currentService.nowPlaying) {
        nowPlaying = currentService.nowPlaying;
      }

      if (currentService && currentService.nowAndNext) {
        nowAndNext = currentService.nowAndNext;
      }

      audio.status()
           .then(function (status) {
              res.render(
                __dirname+"/views/index",
                {
                  currentService : currentService,
                  services       : bbcServices.cache,
                  nowPlaying     : nowPlaying,
                  nowAndNext     : nowAndNext,
                  volume         : status.volume
                }
              );
           });
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

        currentServiceId = id;
      }

      res.redirect('back');
    };

    return app;
}
