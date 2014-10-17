var utils  = require('radiodan-client').utils,
    logger = utils.logger(__filename);

module.exports.create = create;

function create(register, eventBus, settings) {
  var instance = {},
      history  = [],
      currentServiceId;

  instance.change       = change;
  instance.next         = nextService;
  instance.revert       = revert;
  instance.events       = register.events;
  instance.get          = get;
  instance.programmeFor = programmeFor;
  instance.all          = all;
  instance.current      = current;

  settings.get().then(function(setData) {
    instance.default = setData.serviceId;
  });

  return instance;

  function current() {
    return currentServiceId;
  }

  function change(id) {
    var metadata;

    history.push(currentServiceId);

    currentServiceId = id;

    if(currentServiceId) {
      metadata = programmeFor(currentServiceId);
    }

    eventBus.emit('service.id', currentServiceId);
    eventBus.emit('service.changed', metadata);
  }

  function nextService() {
    return settings.get().then(function(setData) {
      var preferred    = setData.preferredServices || [],
          currentIndex = preferred.indexOf(currentServiceId),
          nextIndex    = currentIndex + 1,
          nextServiceId;

      switch(true) {
        case (currentIndex == -1):
        case (nextIndex >= preferred.length):
          nextServiceId = preferred[0];
          break;
        default:
         nextServiceId = preferred[nextIndex];
      }

      logger.info(nextServiceId, currentIndex);
      return nextServiceId;
    }).then(null, utils.failedPromiseHandler(logger));
  }

  function revert() {
    var last = history.pop();
    if (last) {
      change(last);
    }
  }

  /*
   * Functions that defer to register
   */
  function get(serviceId) {
    return register.playlist(serviceId);
  }

  function programmeFor(serviceId) {
    return register.metadata(serviceId);
  }

  function all() {
    return register.stations()
  }
}
