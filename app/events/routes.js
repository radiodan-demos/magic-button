var eventSource = require('express-eventsource'),
    logger      = require('radiodan-client').utils.logger('event-routes');

module.exports = function (app, eventBus, services) {
  var eventStream = eventSource();

  // Shared eventsource
  // To send data call: eventStream.send(dataObj, 'eventName');
  app.use('/', eventStream.middleware());

  services.myMusic.on('*', function (data) {
    eventStream.send(data);
  });

  services.bbc.on('*', function (data) {
    eventStream.send(data);
  });

  eventBus.on('*', function (eventName, args) {
    if (args.length === 1) {
      args = args[0];
    }

    eventStream.send({ topic: eventName, data: args });
  });

  return app;
};
