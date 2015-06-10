var sendServiceToPlayer = require('./helpers/send-service-to-player'),
    utils = require('radiodan-client').utils,
    logger = utils.logger();

module.exports.create = create;

function create(players, ui, audio, services, eventBus) {
  var instance, settings, avoiding, avoidedServiceId;

  instance = {
    name: 'avoid',
    type: 'magic',
    settings: 'avoider',
    events: [{
      name: 'start',
      states: ['online'],
      action: start
    }, {
      name: 'stop',
      states: ['online'],
      action: stop
    }]
  };

  avoiding = false;

  return instance;

  function start(settings) {
    var state = this,
        avoidTopic, avoidingEvent, currentService, message;

    logger.debug('avoid.start', settings);

    avoidedServiceId = services.current();
    currentService = services.programmeFor(avoidedServiceId);

    if (settings.avoidType === 'programmes' && currentService.nowAndNext) {
      logger.info('Avoid programme');

      avoidTopic = 'nowAndNext';
      var currentProgramme = currentService.nowAndNext[0];

      var times = startAndEnd(currentProgramme.start, currentProgramme.end);
    } else if (settings.avoidType === 'tracks' && currentService.nowPlaying) {
      logger.info('Avoid tracks');

      avoidTopic = 'nowPlaying';
      var nowPlaying = currentService.nowPlaying;
      if (nowPlaying.start && nowPlaying.end) {
        var times = startAndEnd(nowPlaying.start, nowPlaying.end);
      }
    } else {
      logger.warn('Cannot avoid');
    }

    ui.RGBLEDs.magic.emit({
      emit: true, colour: ui.colours.blue
    });

    //
    if (!avoidTopic) {
      logger.warn('No avoidTopic set, cannot avoid');
      return;
    }

    players.main.stop();
    sendServiceToPlayer(services.get(settings.serviceId), players.avoider)
      .then(players.avoider.play);

    services.change(settings.serviceId);

    avoidingEvent = avoidedServiceId + '.' + avoidTopic;
    logger.info('waiting for ', avoidingEvent);

    services.events.once(avoidingEvent, function () {
      logger.info('responding to ', avoidingEvent);
      // This is a machina state machine instance
      // so the underlying state name must be specified
      // (using a '.' rather than a ':').
      // Settings will not automatically be fetched
      // so they must be passed in
      state.handle('avoid.stop', settings);
    });

    avoiding = true;

    message = {
      isAvoiding: avoiding,
      from: avoidedServiceId, to: settings.serviceId
    };

    if (times) {
      logger.warn('times: ', times);
      message.start = times.start.toISOString();
      message.end   = times.end.toISOString();
    }

    // Listen for station switching or standby, cancel avoid
    var listener = state.on('handling', function (handled) {
      switch(handled.inputType) {
        case 'play':
          logger.debug('Switching stations, cancel avoiding');
          listener.off();
          cancel();
          break;
        case 'standby':
          logger.debug('Standby, cancel avoiding');
          listener.off();
          cancel();
          break;
        case 'avoid.stop':
          logger.debug('Avoiding finished, clear change station listener');
          listener.off();
          break;
      }
    });

    eventBus.emit('avoider', message);
  }

  function stop(settings) {
    logger.debug('avoid.stop', settings);

    if(!avoiding) {
      logger.warn('Not avoiding, will do nothing');
      return;
    }

    var returningTo = avoidedServiceId;

    delete avoidedServiceId;

    logger.info('stopAvoiding - returning to: ', returningTo);

    avoiding = false;

    eventBus.emit('avoider', {
      isAvoiding: avoiding,
      from: settings.serviceId, to: returningTo
    });

    // TODO
    // ui.RGBLEDs.magic.emit({
    //   emit: true, colour: ui.colours.white
    // });

    players.avoider.clear();

    this.handle('play', returningTo);
  }

  function cancel() {
    logger.debug('avoid - cancel');

    if(!avoiding) {
      logger.warn('Not avoiding, will not cancel');
      return;
    }

    delete avoidedServiceId;

    avoiding = false;

    eventBus.emit('avoider', {
      isAvoiding: avoiding
    });

    // TODO
    // ui.RGBLEDs.magic.emit({
    //   emit: true, colour: ui.colours.white
    // });

    players.avoider.clear();
  }

  function startAndEnd(startDateStr, endDateStr) {
    var startDate = new Date(startDateStr),
        endDate   = new Date(endDateStr),
        times     = null;

    if ( !isNaN(startDate.valueOf()) && !isNaN(endDate.valueOf()) ) {
      times = {
        start: startDate,
        end: endDate
      }
    }

    return times;
  }
}
