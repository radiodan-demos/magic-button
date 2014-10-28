var gulp = require('gulp'),
    less = require('gulp-less'),
    autoprefixer = require('gulp-autoprefixer'),
    browserify = require('browserify'),
    uglify = require('gulp-uglify'),
    streamify = require('gulp-streamify'),
    source = require('vinyl-source-stream');

// Config
var src  = './app/ui/static',
    dest = './public/assets';

var copyConfig = {
  src: ['**', '!css/**', '!js/**'],
  dest: dest
};

var cssConfig = {
  src: src + '/css/app.less',
  dest: dest + '/css'
};

var jsConfig = {
  src: src + '/js/app.js',
  dest: dest + '/js',
  name: 'app.js',
  min: 'app.min.js',
  debug: 'app.debug.js'
};


// Tasks

gulp.task('build', [ 'copy', 'css', 'js' ]);
gulp.task('default', [ 'build' ]);

gulp.task('copy', copy);
gulp.task('css' , css);
gulp.task('js' , js);

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
  var production = browserify( jsConfig.src, { debug: false } ).bundle();
  var debug = browserify( jsConfig.src, { debug: true } ).bundle();

  // Production build, not minified
  production
      .pipe( source(jsConfig.name) )
      .pipe( gulp.dest(jsConfig.dest) );

  // Production build, minified
  production
      .pipe( source(jsConfig.min) )
      .pipe( streamify(uglify()) )
      .pipe( gulp.dest(jsConfig.dest) );

  // Debug build
  debug
      .pipe( source(jsConfig.debug) )
      .pipe( gulp.dest(jsConfig.dest) );

}