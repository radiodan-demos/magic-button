var express        = require("express"),
    http           = require("http"),
    swig           = require("swig"),
    radiodanClient = require("radiodan-client"),
    logger         = radiodanClient.utils.logger(__filename),
    radiodan       = radiodanClient.create(),
    port           = (process.env.PORT || 5000),
    app            = module.exports = express(),
    eventBus       = require('./lib/event-bus').create(),
    Playlists      = require('./lib/playlists');

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

app.use("/avoider",
  require("./app/avoider/routes")(express.Router(), radiodan)
);
app.use("/api",
  require("./app/api/routes")(express.Router(), eventBus, radiodan)
);
app.use("/events",
  require("./app/events/routes")(express.Router(), eventBus)
);
app.use("/",
  require("./app/ui/routes")(express.Router())
);

Playlists.create(eventBus, radiodan);

http.createServer(app).listen(port);
logger.info("Started server on port", port);
