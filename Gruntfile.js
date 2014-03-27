module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    browserify: {
      debug: {
        files: {
          'public/assets/js/app.debug.js': ['app/ui/static/js/app.js']
        },
        options: {
          bundleOptions: {
            debug: true
          }
        }
      },
      app: {
        files: {
          'public/assets/js/app.js': ['app/ui/static/js/app.js']
        }
      }
    },
    uglify : {
      js: {
        files: {
          'public/assets/js/app.min.js' : [ 'public/assets/js/app.js' ]
        }
      }
    },
    watch: {
      files: [ "**/static/**/*.js*"],
      tasks: [ 'default' ]
    }
  });

  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.registerTask('default', [ 'browserify', 'uglify:js' ]);
}
