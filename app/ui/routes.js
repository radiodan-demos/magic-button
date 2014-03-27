var utils  = require("radiodan-client").utils,
    logger = utils.logger(__filename);

module.exports = routes;

function routes(app, radiodan, bbcServices, services, power) {
  var audio = radiodan.audio.get('default');

  app.use("/assets", require("serve-static")(__dirname + "/static/"));
  app.get("/", showIndex);

  // Route implementations
  function showIndex(req, res) {
    utils.promise.spread(
      [
        audio.status(),
        bbcServices.stations()
      ],
      function (status, stations) {
        res.render(
          __dirname+"/views/index",
          {
            isDebug : (process.env.NODE_ENV === 'development')
                      ? true
                      : false,
            json: JSON.stringify({
              power   : { isOn: power.isOn() },
              services: stations,
              current : services.current(),
              audio   : { volume  : status.volume },
              avoider : { isAvoiding: false }
            })
          }
        );
      });
  }

  return app;
}
