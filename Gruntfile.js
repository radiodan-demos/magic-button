module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    copy: {
      main: {
        expand: true,
        cwd: 'app/ui/static/',
        src: ['**', '!css/**', '!js/**'],
        dest: 'public/assets/',
      }
    },
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
    less: {
      all: {
        src: ["app/ui/static/css/app.less"],
        dest: "public/assets/css/app.css"
      },
    },
    autoprefixer: {
      dist: {
        files: {
          "public/assets/css/app.css": ["public/assets/css/app.css"]
        }
      }
    },
    watch: {
      js: {
        files: [ "**/static/**/*.js*" ],
        tasks: [ 'default' ]
      },
      css: {
        files: [ "**/static/**/*.css" ],
        tasks: [ 'css' ]
      },
      files: [ "**/*.html*" ],
      options: {
        livereload: true,
      }
    }
  });

  // JS
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // CSS
  grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-contrib-less');

  // Dev
  grunt.loadNpmTasks('grunt-contrib-watch');

  // General
  grunt.loadNpmTasks('grunt-contrib-copy');

  grunt.registerTask('css', [ 'less', 'autoprefixer' ]);
  grunt.registerTask('default', [ 'copy', 'browserify', 'uglify:js', 'css' ]);
}
