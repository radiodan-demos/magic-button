var utils  = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app) {
  app.use("/assets", require("serve-static")(__dirname + "/static/"));
  app.get("/", showIndex);

  // Route implementations
  function showIndex(req, res) {
    res.render(
      __dirname+"/views/index",
      {}
    );
  }

  return app;
}
