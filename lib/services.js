var ServicesManager  = require('./services/manager'),
    ServicesRegister = require('./services/register'),
    BBCServices      = require('./services/bbc-services'),
    MyMusic          = require('./services/my-music');

module.exports.create = create;

function create(eventBus, settings) {
  var bbcServices    = BBCServices.create(),
      myMusicService = MyMusic.create(eventBus),
      register, manager;

  register = ServicesRegister.create();

  register.register(bbcServices);
  register.register(myMusicService);

  manager = ServicesManager.create(register, eventBus, settings);

  return manager;
}

