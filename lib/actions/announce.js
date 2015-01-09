var utils  = require('radiodan-client').utils,
    logger = utils.logger();

module.exports.create = create;

function create(players, ui, audio, services, eventBus) {
  var volumeDiff = 50,
      instance, settings, active, trigger;

  instance = {
    name: 'announce',
    type: 'magic',
    settings: 'announcer',
    events: [{
      name: 'start',
      states: ['standby', 'online'],
      action: start
    }, {
      name: 'stop',
      states: ['standby', 'online'],
      action: stop
    }]
  };

  active = false;

  return instance;

  // Create helper to trigger stopAnnouncing state action
  //
  function createStopAnnouncingTrigger(player, state) {
    var instance = {};

    instance.handler = function (status) {
      if (status.state === 'stop') {
        state.handle('announce.stop');
      }
    };

    instance.attach = function () {
      player.on('player', instance.handler);
    };

    instance.detach = function () {
      player.removeListener('player', instance.handler);
    };

    return instance;
  };

  function start(announceSettings) {
    var state = this;

console.log('announceSettings', announceSettings);

    trigger = createStopAnnouncingTrigger(players.announcer, state);

    logger.info('announce.start');

    if(announceSettings) {
      settings = announceSettings;
    }

    ui.RGBLEDs.magic.emit({
      emit: true, colour: ui.colours.blue
    });

    reducePlayerVolume()
      .then(function () {
        return fetchAnnounceTrackForState( state, settings );
      })
      .then(function (track) {
        return players.announcer
                .add({
                  clear: true, playlist: [track]
                });
      })
      .then(
        function () {
          trigger.attach();
          return players.announcer.play();
        },
        function () {
          state.handle('announce.stop');
        }
      )
      .catch(utils.failedPromiseHandler());

    active = true;

    var message = {
      isAnnouncing: active
    };

    eventBus.emit('*', 'announcer', message);
  }

  function stop() {
    if(!active) {
      return;
    }

    logger.info('announce.stop');

    trigger.detach();

    players.main
      .volume({ diff: volumeDiff });

    active = false;

    eventBus.emit('*', 'announcer', {
      isAnnouncing: active
    });

    ui.RGBLEDs.magic.emit({
      emit: true, colour: ui.colours.white
    });

    players.announcer.clear();
  }

  function reducePlayerVolume() {
    var dfd = utils.promise.defer();

    players.main.once('volume', function (vol) {
      wait(1000)
        .then(dfd.resolve);
    });

    players.main
      .volume({ diff: -volumeDiff })

    return dfd.promise;
  }

  function fetchAnnounceTrackForState(state, settings) {
    var announceName = settings.announcer.toLowerCase(),
        mp3;

    try {
      if(state.state === 'online') {
        mp3 = announceName + '/playing/' +
              services.current() + '.mp3';
      } else {
        mp3 = announceName + '/status/' + 'standby' + '.mp3';
      }
    } catch(err) {
      logger.warn(err);
      mp3 = null;
    }

    logger.info('track', mp3);
    return utils.promise.resolve(mp3);
  }

  function createWaitPromise(delay) {
    return function () {
      return wait(delay);
    };
  }

  function wait(delay) {
    var dfd = utils.promise.defer();
    setTimeout(dfd.resolve, delay);
    return dfd.promise;
  }
}
