var eventSource = require("express-eventsource");

module.exports = function (app, eventBus) {
  var eventStream = eventSource();

  // Shared eventsource
  // To send data call: eventStream.send(dataObj, 'eventName');
  app.use("/", eventStream.middleware());

  eventBus.on('*', function (eventName, args) {
    eventStream.send(JSON.stringify(args), eventName);
  });

  return app;
};
