var express        = require('express'),
    http           = require('http'),
    swig           = require('swig'),
    radiodanClient = require('radiodan-client'),
    logger         = radiodanClient.utils.logger(__filename),
    radiodan       = radiodanClient.create(),
    port           = (process.env.PORT || 5000),
    app            = module.exports = express(),
    eventBus       = require('./lib/event-bus').create(),
    Settings       = require('./lib/settings').create(eventBus),
    services       = require('./lib/services').create(
                       eventBus, Settings.get('radio')
                     ),
    states         = require('./lib/states').create(radiodan, services, eventBus, Settings);

if (!module.parent) {
  var gracefulExit = require('./lib/graceful-exit')(radiodan);
  process.on('SIGINT', gracefulExit).on('SIGTERM', gracefulExit);
}

app.engine('html', swig.renderFile);
app.set('view engine', 'html');

var env = process.env.NODE_ENV || 'production';
if ('development' == env) {
  swig.setDefaults({ cache: false });
}

logger.info('ENVIRONMENT', env);

app.use(require('errorhandler')({
  dumpExceptions: true,
  showStack: true
}));

app.use(require('body-parser')());
app.use(require('method-override')())
app.use(require('serve-static')(__dirname + '/public'));
app.use(require('morgan')('dev'));

app.use('/announcer',
  require('./app/announcer/routes')(
    express.Router(), states, Settings.get('announcer')
  )
);

app.use('/avoider',
  require('./app/avoider/routes')(
    express.Router(), states, Settings.get('avoider'), eventBus
  )
);

app.use('/events',
  require('./app/events/routes')(
    express.Router(), eventBus, services
  )
);

app.use('/magic-button',
  require('./app/magic-button/routes')(
    express.Router(), states, Settings.get('magic-button')
  )
);

app.use('/radio',
  require('./app/radio/routes')(
    express.Router(), eventBus, radiodan,
    states, services, Settings.get('radio')
  )
);

app.use('/',
  require('./app/ui/routes')(
    express.Router(), radiodan, services
  )
);

http.createServer(app).listen(port);
logger.info('Started server on port', port);
