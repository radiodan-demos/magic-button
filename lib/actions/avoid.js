var utils = require('radiodan-client').utils,
    logger = utils.logger();

module.exports.create = create;

function create(players, ui, services, eventBus) {
  var instance, settings, avoiding, avoidedServiceId;

  instance = [{
    id: 'startAvoiding',
    states: ['online'],
    action: startAvoiding
  }, {
    id: 'stopAvoiding',
    states: ['online'],
    action: stopAvoiding
  }];

  avoiding = false;

  return instance;

  function startAvoiding(avoidSettings) {
    var avoidTopic, avoidingEvent, state;

    state = this;

    logger.info('startAvoiding');

    if(avoidSettings) {
      settings = avoidSettings;
    }

    avoidedServiceId = services.current();

    var currentService = services.get(avoidedServiceId);

    if (settings.avoidType === 'programmes' && currentService.nowAndNext) {
      logger.info('programmes');

      avoidTopic = 'nowAndNext';
      var currentProgramme = currentService.nowAndNext[0];
      var times = startAndEndTimesProgramme(currentProgramme.end);
    } else {
      logger.info('tracks');

      avoidTopic = 'nowPlaying';

      if (settings.avoidType === 'tracks') {
        var nowPlaying = currentService.nowPlaying;
        if (nowPlaying && nowPlaying.duration) {
          var times = startAndEndTimes(nowPlaying.received, nowPlaying.duration);
        }
      }
    }

    ui.RGBLEDs.magic.emit({
      emit: true, colour: ui.colours.blue
    });

    players.main.stop();
    players.avoider
      .add({
        clear: true, playlist: services.get(settings.serviceId)
      })
    .then(players.avoider.play);

    services.change(settings.serviceId);

    avoidingEvent = avoidedServiceId + '.' + avoidTopic;
    logger.info('waiting for ', avoidingEvent);

    services.events.once(avoidingEvent, function () {
      logger.info('responding to ', avoidingEvent);
      state.handle('stopAvoiding');
    });

    avoiding = true;

    var message = {
      isAvoiding: avoiding,
      from: avoidedServiceId, to: settings.serviceId
    };

    if (times) {
      message.start = times.start.toISOString();
      message.end   = times.end.toISOString();
    }

    eventBus.emit('*', 'avoider', message);
  }

  function stopAvoiding() {
    if(!avoiding) {
      return;
    }

    var returningTo = avoidedServiceId;

    delete avoidedServiceId;

    logger.info('stopAvoiding');

    avoiding = false;

    eventBus.emit('*', 'avoider', {
      isAvoiding: avoiding,
      from: settings.serviceId, to: returningTo
    });

    // ui.RGBLEDs.magic.emit({
    //   emit: true, colour: ui.colours.white
    // });

    players.avoider.clear();

    this.handle('play', returningTo);
  }

  function topicFromService(service) {
    var musicServices = ['radio1','1xtra','radio2','radio3','6music'];

    if(musicServices.indexOf(service) > -1) {
      return 'nowPlaying';
    } else {
      return 'nowAndNext';
    }
  }

  function startAndEndTimesProgramme(endDateStr) {
    var endDate = new Date(endDateStr),
        now = new Date(),
        times = null;

    if ( !isNaN(endDate.valueOf()) ) {
      times = {
        start: now,
        end: endDate
      }
    }

    return times;
  }

  function startAndEndTimes(startDateStr, duration) {
    var startDate = new Date(startDateStr),
        times = null,
        endTime,
        endDate;

    if ( duration || !isNaN(startDate.valueOf()) ) {
      endTime = startDate.valueOf() + (duration * 1000);
      endDate = new Date(endTime);
      times = {
        start: startDate,
        end: endDate
      }
    }

    return times;
  }
}
