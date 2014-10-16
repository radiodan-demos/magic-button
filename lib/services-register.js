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
  var serviceExists = this.services().indexOf(serviceId) > -1;

  if(serviceExists) {
    throw new Error('Service ' + serviceId + ' is already registered to ' +
        this._services[serviceId].providerId);
  } else {
    this._services[serviceId] = { providerId: providerId };
  }
}

module.exports.create = function() {
  return new ServicesRegister();
};
