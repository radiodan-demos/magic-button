var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, eventBus, states, bbcServices) {
  var Avoider  = require("./avoider")(
          eventBus, states, bbcServices
      ),
      settings = require("./settings").create();

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
    Avoider.create("radio4").avoid();
    res.redirect("./");
  }
}
