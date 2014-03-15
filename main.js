var express          = require("express"),
    connect          = require("connect"),
    http             = require("http"),
    utils            = require("radiodan-client").utils,
    logger           = utils.logger(__filename),
    bbcServices      = require("./lib/bbc-services").create(),
    port             = (process.env.PORT || 5000),
    server           = module.exports = express();

server.configure(function() {
  server.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
  server.use(connect.methodOverride());
  server.use(connect.urlencoded());
  server.use(connect.json());
  server.use(server.router);
  server.use(connect.static("public"));
});

http.createServer(server).listen(port);
logger.info("Started server on port", port);
