var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, radiodan, bbcServices) {
  var avoidPlayer    = radiodan.player.get("avoider"),
      mainPlayer     = radiodan.player.get("main"),
      announcePlayer = radiodan.player.get("announcer"),
      Avoider        = require("./avoider")(
          bbcServices, mainPlayer, avoidPlayer
      ),
      settings       = require("./settings").create();

    app.get("/", index);
    app.get("/avoid", avoid);

    return app;

  function index(req, res) {
    settings.get().then(function(settings) {
      res.render(
        __dirname+"/views/index",
        { settings: JSON.stringify(settings) }
      );
    }).then(null, utils.failedPromiseHandler(logger));
  }

  function avoid(req, res) {
    bbcServices.ready.then(function() {
      var radio1 = bbcServices.get("radio1").audioStreams[0].url,
          radio4 = bbcServices.get("radio4").audioStreams[0].url;

      mainPlayer.add({playlist: [radio1], clear: true})
        .then(mainPlayer.play)
        .then(function() {
          avoidPlayer.add({playlist: [radio4], clear: true});
        })
        .then(function() {
          setTimeout(Avoider.create("radio1").avoid, 5000);
        });

      res.redirect("./");
    }, utils.failedPromiseHandler(logger));
  }
}
