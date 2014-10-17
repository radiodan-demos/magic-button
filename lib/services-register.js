var utils = require('radiodan-client').utils;

var ServicesRegister = function() {
  this._providers = {};
  this._services = {};
};

ServicesRegister.prototype.register = function(serviceprovider) {
  var providerId = serviceprovider.id,
      exists     = Object.keys(this._providers).indexOf(providerId) > -1;

  if(exists) {
    return utils.promise.reject('Provider ' + providerId + ' already registered');
  } else {
    return this._registerProvider(providerId, serviceprovider);
  }
};

ServicesRegister.prototype.metadata = function(serviceId) {
  var provider = this.providerOf(serviceId);

  if(provider) {
    provider.metadata(serviceId);
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

ServicesRegister.prototype.services = function() {
  return Object.keys(this._services);
}

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
