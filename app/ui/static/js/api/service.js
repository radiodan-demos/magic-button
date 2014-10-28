var xhr = require('../xhr'),
    success = require('../utils').success,
    failure = require('../utils').failure;

module.exports = function (value) {
  xhr.post('/radio/service/' + value )
     .then(success('service'), failure('service'));
}