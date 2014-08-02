var Backbone = require('backbone');

/*
  This model represents a list of tunable services
  available on the radio.
  - exposes a list of services (with now/next and now playing info)
  - knows which service is current tuned
  - allows callers to change the tuned service
*/
module.exports = Backbone.Model.extend({
  tuneToId: function (id) {
    var services = this.get('services'),
        current  = null;

    console.log('tuneToId', id);
    console.log('services', services.length, services);

    if (id) {
      current = services.findWhere({ id: id });
    }

    console.log('current', id, current);

    this.set('current', current);
  }
});