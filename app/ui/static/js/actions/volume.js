var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure;

module.exports = function (value) {
  xhr.post('/radio/volume/value/' + value )
     .then(success('volume'), failure('volume'));
}