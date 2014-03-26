var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, eventBus, states, bbcServices) {
  var Avoider  = require("./avoider")(
          eventBus, states, bbcServices
      ),
      settings = require("./settings").create(),
      avoider;

    app.get("/", index);
    app.post("/", avoid);
    app.delete("/", cancel);

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
