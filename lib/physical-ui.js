var logger  = require('radiodan-client').utils.logger(__filename),
    colours = {
      blue   : [0, 0, 255],
      green  : [0, 255, 0],
      red    : [255, 0, 0],
      white  : [255, 255, 255],
      yellow : [255, 255, 0]
    };

module.exports.create = function(radiodan, state) {
  var nextButton    = radiodan.button.get('next'),
      powerButton   = radiodan.button.get('power'),
      magicButton   = radiodan.button.get('magic'),
      powerLED      = radiodan.RGBLED.get('power'),
      magicLED      = radiodan.RGBLED.get('magic'),
      volumeEncoder = radiodan.rotaryEncoder.get('volume'),
      magicEncoder  = radiodan.rotaryEncoder.get('magic');

  nextButton.on('press', function(args) {
    logger.info('nextButton', 'pressed', args);
    state.handle('playNextService');
  });

  powerButton.on('press', function(args) {
    logger.info('powerButton', 'pressed', args);
    state.handle('power');
  });

  magicButton.on('press', function(args) {
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

  return {
    colours: colours,
    buttons: { next: nextButton, power: powerButton, magic: magicButton },
    RGBLEDs: { power: powerLED, magic: magicLED },
    rotaryEncoders: { volume: volumeEncoder, magic: magicEncoder }
  };
};
