var express        = require("express"),
    http           = require("http"),
    radiodanClient = require("radiodan-client"),
    bbcServices    = require("./lib/bbc-services").create().connect(),
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
app.use("/avoider",
  require("./app/avoider/routes")(express.Router(), radiodan, bbcServices)
);

http.createServer(app).listen(port);
logger.info("Started server on port", port);
