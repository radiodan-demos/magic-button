var express        = require("express"),
    http           = require("http"),
    namespace      = require("express-namespace"),
    radiodanClient = require("radiodan-client"),
    logger         = radiodanClient.utils.logger(__filename),
    radiodan       = radiodanClient.create(),
    port           = (process.env.PORT || 5000),
    app            = module.exports = express();

if (!module.parent) {
  var gracefulExit = require("./lib/graceful-exit")(radiodan);
  process.on("SIGINT", gracefulExit).on("SIGTERM", gracefulExit);
}

app.use(require("errorhandler")({
  dumpExceptions: true,
  showStack: true
}));

app.use(require("body-parser")());
app.use(require("method-override")())
app.use(require("serve-static")("public"));
app.use(require("morgan")("dev"));

app.use("/radiodan", radiodanClient.middleware());
app.namespace("/avoider", require("./app/avoider/routes")(app,radiodan));

http.createServer(app).listen(port);
logger.info("Started server on port", port);
