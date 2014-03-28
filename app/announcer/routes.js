var utils    = require("radiodan-client").utils,
    settingsRoutes = require("../settings/routes"),
    logger   = utils.logger(__filename);

module.exports = routes;

function routes(app, states, Settings) {
  var settings = Settings.build(
        "announcer",
        { speak: false, announcer: "marvin" }
      );

  app.get("/", index);
  app.use(settingsRoutes(settings));

  return app;

  function index(req, res) {
    res.json({page: "Announcer"});
  }
}
