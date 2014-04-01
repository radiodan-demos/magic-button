var eventSource = require("express-eventsource");

module.exports = function (app, eventBus, services) {
  var eventStream = eventSource();

  // Shared eventsource
  // To send data call: eventStream.send(dataObj, 'eventName');
  app.use("/", eventStream.middleware());

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
