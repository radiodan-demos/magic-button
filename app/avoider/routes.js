var utils    = require("radiodan-client").utils,
    logger   = utils.logger(__filename);

module.exports = routes;

function routes(app, radiodan, bbcServices, states, Settings) {
  var Avoider  = require("./avoider")(
          states, bbcServices
      ),
      settings = Settings.build(
        "avoider",
        { serviceId: null, avoidType: "programme" }
      ),
      avoider;

    app.get("/", index);
    app.post("/", avoid);
    app.delete("/", cancel);

    app.get("/settings.json",  settingsIndex);
    app.post("/settings.json", settingsUpdate);

    return app;

  function index(req, res) {
    res.render(
      __dirname+"/views/index"
    );
  }

  function avoid(req, res) {
    if (avoider) {
      avoider.cancel();
    }
    avoider = Avoider.create("radio4");
    avoider.avoid();
    res.redirect("./");
  }

  function cancel(req, res) {
    logger.info('/avoid', avoider);
    if (avoider) {
      avoider.cancel();
    }
    res.redirect("./");
  }

  function settingsIndex(req, res) {
    settings.get().then(function(settings) {
      res.json(settings);
    });
  }

  function settingsUpdate(req, res) {
    var newSettings = req.body;

    settings.set(newSettings).then(function() {
      res.json(newSettings);
    }, function(err) { res.json(500, {error: err.toString()}) });
  }
}
