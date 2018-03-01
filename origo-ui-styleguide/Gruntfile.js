'use strict';
var fs = require('fs');

module.exports = function (grunt) {
  // TODO: Add back auto prefixing!
  // grunt.loadNpmTasks('grunt-autoprefixer');
  grunt.loadNpmTasks('grunt-svgstore');
  grunt.loadNpmTasks('grunt-svginjector');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-sass');

  grunt.initConfig({
    svgstore: {
      options: {
        cleanup: true,
        convertNameToId: function (name) {
          return name.replace(/^svg_/, '');
        }
      },

      icons: {
        files: {
          '.tmp/icons.svg': ['images/icons/*.svg']
        },

        options: {
          prefix: 'icon-'
        }
      },

      logos: {
        files: {
          '.tmp/logos.svg': ['images/logos/*.svg']
        },

        options: {
          prefix: 'logo-'
        }
      }
    },

    svginjector: {
      icons: {
        files: {
          'scripts/icons.js': ['.tmp/icons.svg', '.tmp/logos.svg']
        },
        options: {
          container: 'icon-container'
        }
      }
    },

    connect: {
      dev: {
        options: {
          port: '3000',
          middleware: function(connect, options, middlewares) {
            middlewares.unshift(function(req, res, next) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', '*');
              next();
            });

            return middlewares;
          }
        }
      },
      prod: {
        options: {
          port: process.env.PORT || '3000',
          keepalive: true,
          base: [
            {path: 'styleguide', options: {maxAge: 1000 * 60}},
            {path: 'dist', options: {maxAge: 1000 * 60}},
            {path: '.', options: {maxAge: 1000 * 60}},
          ],
          middleware: function(connect, options, middlewares) {
            middlewares.unshift(function(req, res, next) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', '*');
              next();
            });

            return middlewares;
          }
        }
      }
    },

    watch: {
      css: {
        files: ['styles/**'],
        tasks: ['sass', 'cssmin']
      },
      icons: {
        files: ['images/icons/**'],
        tasks: ['icons']
      },
      styleguide: {
        files: ['styleguide/index.tpl.html', 'styleguide/sections/*.html'],
        tasks: ['build-styleguide']
      }
    }
  });

  grunt.registerTask('build-styleguide', function () {
    var sections = grunt.file.expand(['styleguide/sections/*.html'])
      .sort()
      .map(function (path) {
        return grunt.file.read(path);
      });
    var template = grunt.file.read('styleguide/index.tpl.html');
    var rendered = grunt.template.process(template, {
      data: {
        nb: grunt.file.read('styleguide/nb.html'),
        sections: sections
      }
    });
    grunt.file.write('styleguide/index.html', rendered);
  });

  grunt.registerTask('icons', [
    'svgstore:icons',
    'svgstore:logos',
    'svginjector:icons'
  ]);

  grunt.registerTask('build', [
    'icons',
    'build-styleguide'
  ]);

  grunt.registerTask('minimal', [
    'icons',
    'build-styleguide'
  ]);

  grunt.registerTask('dev', [
    'build',
    'connect:dev',
    'watch'
  ]);

  grunt.registerTask('serve', [
    'build',
    'connect:prod'
  ]);

  grunt.registerTask('default', 'build');
};
