var eventSource = require('express-eventsource'),
    logger      = require('radiodan-client').utils.logger('event-routes');

module.exports = function (app, eventBus, services) {
  var eventStream = eventSource();

  // Shared eventsource
  // To send data call: eventStream.send(dataObj, 'eventName');
  app.use('/', eventStream.middleware());

  ['nowAndNext', 'nowPlaying', 'liveText'].forEach(function (topic) {
    services.events.on('*.' + topic, createMessageEmitter(topic));
  });

  function createMessageEmitter(topic) {
    return function (data, metadata) {
      eventStream.send({ topic: topic, serviceId: metadata.serviceId, data: data });
    };
  }

  [ 'settings.*', 'service.changed', 'power', 'exit', 'shutdown',
    'audio', 'announcer'].forEach(function (topic) {
    eventBus.on(topic, function (args) {
      if (args && args.length === 1) {
        args = args[0];
      }
      eventStream.send({ topic: this.event, data: args });
    });
  });

  return app;
};
