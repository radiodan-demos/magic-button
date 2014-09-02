var radiotag = require('radiotag.js'),
    utils = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports = function(players, ui, services, state, settings) {

  ui.RGBLEDs.magic.emit({
    emit: true, colour: ui.colours.orange
  });

  return {
    tag: tag
  };

  function tag() {
    settings.get()
      .then(function (settings) {
        var service     = services.programmeFor(services.current()),
            stationId   = service ? service.dabId : null,
            uri         = radiotag.utils.getUri(settings.tagServer),
            accessToken = settings.accessToken;

        if (stationId) {
          radiotag.tag(stationId, uri, accessToken, done);
        } else {
          done(new Error('No service or service has no dab id'));
        }

        function done(error, tag) {
          var msg = error ? { state: 'error' , data: error }
                          : { state: 'tagged', data: tag   };
          state.emit('msg', 'radiotag', msg);
          ui.RGBLEDs.magic.emit({
            emit: true, colour: ui.colours.orange
          });
        }
      })
      .then(null, utils.failedPromiseHandler(logger));

    state.emit('msg', 'radiotag', { state: 'tagging' });
    ui.RGBLEDs.magic.emit({
      emit: true, colour: [0, 0, 0]
    });
  }

  function stopAvoiding() {
    var returningTo = avoidedServiceId;

    delete avoidedServiceId;

    logger.info('stopAvoiding');

    avoiding = false;

    state.emit('msg', 'avoider', {
      isAvoiding: avoiding,
      from: settings.serviceId, to: returningTo
    });

    ui.RGBLEDs.magic.emit({
      emit: true, colour: ui.colours.white
    });

    players.avoider.clear();

    return returningTo;
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
