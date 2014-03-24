var express        = require("express"),
    eventSource    = require("express-eventsource"),
    http           = require("http"),
    swig           = require("swig"),
    radiodanClient = require("radiodan-client"),
    bbcServices    = require("./lib/bbc-services").create().connect(),
    Settings       = require("./lib/settings").create(),
    logger         = radiodanClient.utils.logger(__filename),
    radiodan       = radiodanClient.create(),
    port           = (process.env.PORT || 5000),
    app            = module.exports = express(),
    eventStream    = eventSource();

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

// Shared eventsource
// To send data call: eventStream.send(dataObj, 'eventName');
app.use("/events", eventStream.middleware());

app.use("/radiodan", radiodanClient.middleware());
app.use("/avoider",
  require("./app/avoider/routes")(
    express.Router(), radiodan, bbcServices, Settings
  )
);
app.use("/",
  require("./app/core/routes")(
    express.Router(), radiodan, eventStream, bbcServices
  )
);

http.createServer(app).listen(port);
logger.info("Started server on port", port);
