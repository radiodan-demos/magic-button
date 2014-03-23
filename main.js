var express        = require("express"),
    http           = require("http"),
    swig           = require("swig"),
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

app.engine("html", swig.renderFile);
app.set("view engine", "html");

var env = process.env.NODE_ENV || 'production';
if ('development' == env) {
  swig.setDefaults({ cache: false });
}

logger.info('ENVIRONMENT', env);

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
app.use("/",
  require("./app/core/routes")(express.Router(), radiodan, bbcServices)
);

http.createServer(app).listen(port);
logger.info("Started server on port", port);
