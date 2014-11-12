var logger  = require('radiodan-client').utils.logger(__filename),
    colours = {
      black  : [0, 0, 0],
      blue   : [0, 0, 255],
      green  : [0, 255, 0],
      red    : [255, 0, 0],
      white  : [255, 255, 255],
      yellow : [255, 255, 0]
    },
    ShutdownState = {
      PENDING: 'pending',
      CONFIRMED: 'confirmed'
    };

module.exports.create = function(radiodan) {
  var nextButton    = radiodan.button.get('next'),
      powerButton   = radiodan.button.get('power'),
      magicButton   = radiodan.button.get('magic'),
      powerLED      = radiodan.RGBLED.get('power'),
      magicLED      = radiodan.RGBLED.get('magic'),
      volumeEncoder = radiodan.rotaryEncoder.get('volume'),
      magicEncoder  = radiodan.rotaryEncoder.get('magic'),
      // TODO: emit shutdown over state machine, not directly
      device        = radiodan.device.get(),
      shutdownState = null;

  var objects = {
    colours: colours,
    buttons: { next: nextButton, power: powerButton, magic: magicButton },
    RGBLEDs: { power: powerLED, magic: magicLED },
    rotaryEncoders: { volume: volumeEncoder, magic: magicEncoder },
  };

  powerLED.emit({
    emit: true,
    colour: colours.red
  });

  return {
    objects: objects,
    bindToState: bindToState
  };

  function bindToState(state) {
    nextButton.on('release', function(args) {
      logger.info('nextButton', 'pressed', args);
      state.handle('playNext');
    });

    powerButton.on('release', function(args) {
      logger.info('powerButton', 'pressed', args);
      if (shutdownState !== ShutdownState.CONFIRMED) {
        state.handle('power');
      }
    });

    powerButton.on('hold', function(args) {
      logger.info('hold', args.durationMs);
      if (!shutdownState && args.durationMs > 3000) {
        logger.info('SHUTDOWN');
        shutdownState = ShutdownState.PENDING;
        device.shutdown()
          .then(function () {
            logger.info('Shutdown reply');
            shutdownState = ShutdownState.CONFIRMED;
            // Change to yellow
            powerLED.emit({
              emit: true,
              colour: colours.yellow,
              transition: { duration: 200 }
            });
            // Flash yellow
            powerLED.emit({
              emit: true,
              colour: colours.black,
              transition: {
                yoyo: true
              }
            });
          },
          function (err) {
            logger.warn('Error sending shutdown request', err);
            shutdownState = null;
          });
      }
    });

    magicButton.on('release', function(args) {
      logger.info('magicButton', 'pressed', args);
      state.handle('magicButton');
    });

    volumeEncoder.on('turn', function(args) {
      var audioDevice = radiodan.audio.get('default'),
      diff = 10; //args.distance;

      if(args.direction === 'anticlockwise') {
        diff = -diff;
      }

      logger.info('volumeEncoder', 'turned', args);
      audioDevice.volume({diff: diff});
    });

    magicEncoder.on('turn', function(args) {
      logger.info('magicEncoder', 'turned', args);

      // do magic here
    });
  }
};
