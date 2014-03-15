var express        = require("express"),
    connect        = require("connect"),
    http           = require("http"),
    radiodanClient = require("radiodan-client"),
    logger         = radiodanClient.utils.logger(__filename),
    radiodan       = radiodanClient.create(),
    bbcServices    = require("./lib/bbc-services").create(),
    Avoider        = require("./lib/avoider")(radiodan, bbcServices),
    port           = (process.env.PORT || 5000),
    app            = module.exports = express();


if (!module.parent) {
  var gracefulExit = require("./lib/graceful-exit")(radiodan);
  process.on("SIGINT", gracefulExit).on("SIGTERM", gracefulExit);
}

app.configure(function() {
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
  app.use(connect.methodOverride());
  app.use(connect.urlencoded());
  app.use(connect.json());
  app.use(app.router);
  app.use("/radiodan", radiodanClient.middleware());
  app.use(connect.static("public"));
});

http.createServer(app).listen(port);
logger.info("Started server on port", port);
