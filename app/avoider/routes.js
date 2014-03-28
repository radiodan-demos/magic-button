var utils    = require("radiodan-client").utils,
    settingsRoutes = require("../settings/routes"),
    logger   = utils.logger(__filename);

module.exports = routes;

function routes(app, bbcServices, states, Settings) {
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

  app.use(settingsRoutes(app, settings));

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
}
