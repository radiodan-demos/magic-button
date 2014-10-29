var gulp = require('gulp'),
    less = require('gulp-less'),
    autoprefixer = require('gulp-autoprefixer'),
    browserify = require('browserify'),
    watchify = require('watchify'),
    livereload = require('gulp-livereload'),
    uglify = require('gulp-uglify'),
    streamify = require('gulp-streamify'),
    source = require('vinyl-source-stream'),
    transform = require('vinyl-transform'),
    exorcist = require('exorcist'),
    clone = require('gulp-clone'),
    Promise = require('es6-promise').Promise,
    _ = require('underscore');

// Config
var src  = './app/ui/static',
    dest = './public/assets';

var copyConfig = {
  src: ['**', '!css/**', '!js/**'],
  dest: dest
};

var cssConfig = {
  src: src + '/css/app.less',
  dest: dest + '/css',
  watch: src + '/css/**'
};

var jsConfig = {
  src: src + '/js/app.js',
  dest: dest + '/js',
  name: 'app'
};

var viewsConfig = {
  watch: './app/ui/views/**/*.html'
};

// Tasks

gulp.task('build', [ 'copy', 'css', 'js' ]);
gulp.task('default', [ 'build' ]);

gulp.task('copy', copy);
gulp.task('css' , css);
gulp.task('js' , js);

gulp.task('watch', watch);
gulp.task('reload', reload);

// Definitions
function copy() {
  console.log( copyConfig.src + ' -> ' + copyConfig.dest );
  gulp.src( copyConfig.src, { cwd: src } )
      .pipe( gulp.dest(copyConfig.dest) );
}


function css() {
  console.log( cssConfig.src + ' -> ' + cssConfig.dest );
  gulp.src( cssConfig.src )
      .pipe( less() )
      .pipe( autoprefixer({ cascade: false }) )
      .pipe( gulp.dest(cssConfig.dest) );
}

function js() {
  // Always include source maps
  var sourceBundle = browserify( jsConfig.src, { debug: true } ).bundle();

  return Promise.all([
    // Unminifed
    compileJs(sourceBundle, jsConfig.name, jsConfig.dest, false),
    // Minifed
    compileJs(sourceBundle, jsConfig.name + '.min', jsConfig.dest, true)
  ]);
}

function compileJs(sourceBundle, name, dest, shouldMinify) {
  return new Promise(function (resolve, reject) {
    var stream = sourceBundle
      .pipe(  source(name + '.js') )
      .pipe(
        // Extract source maps into own file
        transform(function () { return exorcist(dest + '/' + name + '.map'); })
      );

    if (shouldMinify) {
      stream = stream.pipe( streamify(uglify()) );
    }

    stream.pipe( gulp.dest(dest) )
      .on('error', reject)
      .on('end', resolve);
  });
}

function watch() {
  var opts = {
    cache: {},
    packageCache: {},
    fullPaths: true,
    debug: true
  },
  bundler;

  bundler = watchify( browserify( jsConfig.src, opts ) );

  livereload.listen();

  function rebundle() {
    console.log('Starting Watchify rebundle');
    var t = Date.now();

    bundler
      .bundle()
      .pipe( source(jsConfig.name + '.js') )
      .pipe(
        // Extract source maps into own file
        transform(function () { return exorcist(jsConfig.dest + '/' + jsConfig.name + '.map'); })
      )
      .pipe( gulp.dest(jsConfig.dest) )
      .on('end', function () {
        console.log('Finished bundling', ( Date.now() -  t ) / 1000 + ' s');
        livereload.changed();
      });
  }

  bundler.on('update', rebundle);

  gulp.watch(cssConfig.watch, ['css', 'reload']);
  gulp.watch(copyConfig.watch, { cwd: copyConfig.src }, ['copy', 'reload']);
  gulp.watch(viewsConfig.watch, ['reload']);

  return rebundle();
}

function reload() {
  livereload.changed();
}