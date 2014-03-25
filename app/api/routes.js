var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, radiodan, eventStream, bbcServices) {
  var avoidPlayer    = radiodan.player.get("avoider"),
      mainPlayer     = radiodan.player.get("main"),
      announcePlayer = radiodan.player.get("announcer"),
      audio          = radiodan.audio.get("default"),
      currentServiceId;

    app.get("/playing", playService);

    // Broadcast along event stream
    bbcServices.on('nowPlaying', function (service, data) {
      eventStream.send(data, 'nowPlaying');
    });

    function playService(req, res) {
      var id  = req.query.id,
          service = bbcServices.get(id),
          url;

      if (service) {
        url = service.audioStreams[0].url;
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
