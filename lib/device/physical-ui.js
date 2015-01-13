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
      PENDING: 'pending'
    };

function augmentWithQueue(obj) {
  var queue = [];
  obj.enqueue = function (fn, delay) {
    queue.push( setTimeout(wrap(fn), delay) );
  };
  obj.clearQueue = function () {
    queue.forEach(clearTimeout);
    queue = [];
  };
  obj.clearAndEnqueue = function (fn, delay) {
    obj.clearQueue();
    obj.enqueue(fn, delay);
  };
  function wrap(fn) {
    return function () {
      fn();
    };
  }
}

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


  augmentWithQueue(powerLED);
  augmentWithQueue(magicLED);

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
      if (!shutdownState) {
        state.handle('power');
      }
    });

    powerButton.on('hold', function(args) {
      logger.info('hold', args.durationMs);
      if (!shutdownState && args.durationMs > 3000) {
        logger.info('SHUTDOWN');
        shutdownState = ShutdownState.PENDING;
        state.handle('shutdown');
      }
    });

    magicButton.on('release', function(args) {
      logger.info('magicButton', 'pressed', args);
      state.handle('magic');
    });

    var turnOff = {
      colour: [0,0,0],
      transition: {
        duration: 100
      }
    },
    turnOn = {
      colour: [0, 255, 0],
      transition: {
        duration: 0
      }
    };

    volumeEncoder.on(
      'turn',
      debounce(handleVolumeChange, 500)
    );

    function handleVolumeChange(args) {
      logger.info('volumeEncoder turned', args);

      powerLED.change({
        queue: [turnOff, turnOn]
      });

      if(args.direction === 'clockwise') {
        state.handle('volumeUp');
      } else {
        state.handle('volumeDown');
      }
    }

    magicEncoder.on('turn', function(args) {
      logger.info('magicEncoder', 'turned', args);

      // do magic here
    });
  }
};

function debounce(fn, delay) {
  var timer = null;
  return function () {
    var context = this, args = arguments;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, delay);
  };
}
