module.exports = { create: create };


function create(array) {
  var instance = {},
      services = array;

  // Find a single service by ID
  instance.findById = findService;

  // Return all services
  instance.list = function () { return services };

  // Update data about a service
  instance.update = updateService;

  function updateService(data) {
    var index = findServiceIndexById(data.id);
    services.splice(index, 1, data);
  }

  function findServiceIndexById(id) {
    var index = null;
    services.forEach(function (item, idx) {
      if (item.id === id) {
        index = idx;
      }
    });
    return index;
  }

  function findService(id) {
    return findFirst(services, 'id', id);
  }

  function findFirst(array, element, value) {
    var results = array.filter(function (item) {
      return item[element] === value;
    });
    if (results) {
      return results[0];
    }
  }

  return instance;
}
