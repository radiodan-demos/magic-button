var utils    = require("radiodan-client").utils,
    logger   = utils.logger(__filename);

module.exports = routes;

function routes(app, states, Settings) {
  var settings = Settings.build(
        "announcer",
        { speak: false, announcer: "marvin" }
      );

    app.get("/", index);

    app.get("/settings.json",  settingsIndex);
    app.post("/settings.json", settingsUpdate);

    return app;

  function index(req, res) {
    res.json({page: "Announcer"});
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
