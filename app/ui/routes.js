module.exports = routes;

function routes(app) {
  app.get("/", showIndex);

  // Route implementations
  function showIndex(req, res) {
    res.render(
      __dirname+"/views/index",
      {
        isDebug : (process.env.NODE_ENV === 'development')
      }
    );
  }

  return app;
}
