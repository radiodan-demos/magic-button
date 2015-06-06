var Logger = require('js-logger');

module.exports = function (logLevel) {
  var level = logLevel.toUpperCase();
  console.log('Log level %o requested', level);
  Logger.useDefaults();
  if (Logger[level]) {
    Logger.setLevel(Logger[level]);
    console.log('Log level %o set', level);
  } else {
    console.warn('%o not available', level);
  }
}