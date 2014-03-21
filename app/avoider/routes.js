module.exports = routes;

function routes(app, radiodan, bbcServices) {
  var avoidPlayer    = radiodan.player.get("avoider"),
      mainPlayer     = radiodan.player.get("main"),
      announcePlayer = radiodan.player.get("announcer"),
      Avoider        = require("./avoider")(
          bbcServices, mainPlayer, avoidPlayer
      );

    app.get('/', index);
    app.get('/avoid', avoid);

    return app;

  function index(req, res) {
    res.send("THIS IS AVOID HOMEPGE<br><a href='/avoider/avoid'>AVOID</a>");
    res.end();
  }

  function avoid(req, res) {
    var radio1 = bbcServices.store["radio1"].audioStream[0].url,
        radio4 = bbcServices.store["radio4/fm"].audioStream[0].url;

    mainPlayer.add({playlist: [radio1], clear: true})
      .then(mainPlayer.play)
      .then(function() {
        avoidPlayer.add({playlist: [radio4], clear: true});
      })
      .then(function() {
        setTimeout(Avoider.create("radio1").avoid, 5000);
      });

    res.redirect("./");
  }
}
