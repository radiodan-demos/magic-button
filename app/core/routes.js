var utils = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, radiodan, bbcServices) {
  var avoidPlayer    = radiodan.player.get("avoider"),
      mainPlayer     = radiodan.player.get("main"),
      announcePlayer = radiodan.player.get("announcer");

    app.use("/assets", require("serve-static")(__dirname + "/static"));
    app.get("/", showIndex);

    return app;
}

function showIndex(req, res) {
  res.render(
    __dirname+"/views/index",
    {}
  );
}
