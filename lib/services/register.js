var utils = require('radiodan-client').utils,
    EventEmitter = require('events').EventEmitter;

var ServicesRegister = function() {
  this._providers = {};
  this._services = {};
  this.events = new EventEmitter();
};

ServicesRegister.prototype.register = function(serviceprovider) {
  var self       = this,
      providerId = serviceprovider.id,
      exists     = Object.keys(self._providers).indexOf(providerId) > -1;

  if(exists) {
    return utils.promise.reject('Provider ' + providerId + ' already registered');
  } else {
    return self._registerProvider(providerId, serviceprovider)
      .then(function() {
        self._bindToEvents(providerId, serviceprovider);
      });
  }
};

ServicesRegister.prototype.metadata = function(serviceId) {
  var provider = this.providerOf(serviceId);

  if(provider) {
    return provider.metadata(serviceId);
  } else {
    throw new Error("No provider found for " + serviceId);
  }
};

ServicesRegister.prototype.playlist = function(serviceId) {
  var provider = this.providerOf(serviceId);

  if(provider) {
    return provider.playlist(serviceId);
  } else {
    throw new Error("No provider found for " + serviceId);
  }
};

ServicesRegister.prototype.providerOf = function(serviceId) {
  var exists = this.services().indexOf(serviceId) > -1;

  if(exists) {
    var service = this._services[serviceId];
    return this._providers[service.providerId];
  } else {
    return undefined;
  }
};

ServicesRegister.prototype._registerProvider = function(providerId, serviceprovider) {
  var that = this,
      dfd  = utils.promise.defer();

  this._providers[providerId] = serviceprovider;

  serviceprovider.fetchServices()
    .then(function(services) {
      services.forEach(function(serviceId) {
        try {
          that._registerService(providerId, serviceId);
        } catch(err) {
          dfd.reject(err);
        }
      });

      dfd.resolve();
    });

  return dfd.promise;
}

ServicesRegister.prototype._bindToEvents = function(providerId, provider) {
  var self = this;

  try {
    provider.on('*', function(data) {
      self.events.emit('*', data);
      self.events.emit(providerId, data);
    });
  } catch(err) {
    logger.error('Cannnot bind ' + providerId + ' to events');
  }
}

ServicesRegister.prototype.services = function() {
  return Object.keys(this._services);
}

ServicesRegister.prototype.stations = function() {
  var providers = this._providers, promises;

  promises = Object.keys(providers).map(function(k) {
    return providers[k].stations();
  });

  return utils.promise.all(promises)
    .then(function(allStations) {
      return allStations.reduce(function(a,b) {
        return a.concat(b);
      });
  });
};

ServicesRegister.prototype._registerService = function(providerId, serviceId) {
  var existingProvider = this.providerOf(serviceId);

  if(existingProvider) {
    throw new Error('Service ' + serviceId + ' is already registered to ' +
        existingProvider.id);
  } else {
    this._services[serviceId] = { providerId: providerId };
  }
}

module.exports.create = function() {
  return new ServicesRegister();
};
