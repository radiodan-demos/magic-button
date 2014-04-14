var logger = require('radiodan-client').utils.logger(__filename),
    red    = [255, 0, 0],
    green  = [0, 255, 0],
    blue   = [0, 0, 255],
    white  = [255, 255, 255];

module.exports.create = function(eventBus, radiodan) {
  var nextButton    = radiodan.button.get('next'),
      powerButton   = radiodan.button.get('power'),
      magicButton   = radiodan.button.get('magic'),
      powerLED      = radiodan.RGBLED.get('power'),
      magicLED      = radiodan.RGBLED.get('magic'),
      volumeEncoder = radiodan.rotaryEncoder.get('volume'),
      magicEncoder  = radiodan.rotaryEncoder.get('magic');

  nextButton.on('press', function(args) {
    logger.info('nextButton', 'pressed', args);

    //eventBus.emit('nextStation');
  });

  powerButton.on('press', function(args) {
    logger.info('powerButton', 'pressed', args);

    // toggle power
    // send colour to LED
    //powerLED.colour({value: (red || green)});
  });

  magicButton.on('press', function(args) {
    logger.info('magicButton', 'pressed', args);

    //eventBus.emit('magicButton');
    //magicLED.colour({value: (red || green)});
  });

  volumeEncoder.on('turn', function(args) {
    var audioDevice = radiodan.audio.get('system');

    logger.info('volumeEncoder', 'turned', args);

    // set volume here
  });

  magicEncoder.on('turn', function(args) {
    logger.info('magicEncoder', 'turned', args);

    // do magic here
  });

  return {
    buttons: { next: nextButton, power: powerButton, magic: magicButton },
    RGBLEDs: { power: powerLED, magic: magicLED },
    rotaryEncoders: { volume: volumeEncoder, magic: magicEncoder }
  };
};
