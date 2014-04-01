var express = require('express');

module.exports = function(settings) {
  var app = express.Router();

  app.get('/settings.json',  settingsIndex);
  app.post('/settings.json', settingsUpdate);

  return app;

  function settingsIndex(req, res) {
    settings.get().then(function(fetched) {
      res.json(fetched);
    });
  }

  function settingsUpdate(req, res) {
    var newSettings = req.body;

    settings.set(newSettings).then(function() {
      res.json(newSettings);
    }, function(err) { res.json(500, {error: err.toString()}) });
  }
};
