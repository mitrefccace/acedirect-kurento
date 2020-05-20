module.exports = function(grunt) {
  require('jit-grunt')(grunt);

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    concat: {
      options: {
        banner: '/*!\n' +
        ' * @license ACEDirect v<%= pkg.version %>\n' +
        ' * Copyright <%= grunt.template.today("yyyy") %> ACEDirect. All Rights Reserved.\n' +
        ' */\n'
      },

      ACEKurento: {
        src: [
          'src/third-party/kurento-utils.js',
          'src/ACEKurento.js'
        ],
        dest: 'dist/ACEKurento-<%= process.env.version || pkg.version %>.js'
      }
    },
    uglify: {
      options: {
        preserveComments: function(node, comment) {
          if (/@(preserve|license|cc_on)/.test(comment.value))
            return true;
        },
        sourceMap: true
      },
      ACEKurento: {
        src: '<%= concat.ACEKurento.dest %>',
        dest: 'dist/ACEKurento-<%= process.env.version || pkg.version %>.min.js'
      }
    },
    karma: {
      unit: {
        configFile: 'karma.conf.js',
        options: {
          files: [
            'dist/ACEKurento-<%= process.env.version || pkg.version %>.js',
            'tests/spec/*/*Spec.js',
            'tests/spec/helpers/**/*Helper.js'
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-karma');

  grunt.registerTask('test', ["karma"]);

  grunt.registerTask('clear-version', 'Reset version variable in process.env', function() {
    delete process.env.version;
  });

  grunt.registerTask('build-version', 'Generates a version of ACEKurento.js library', function(type) {
    var pkg = grunt.config.data.pkg;
    var version = pkg.version.split('.');

    var major = version[0],
    minor = version[1];

    switch (type) {
      case 'major':
        process.env.version = major
        break;
      case 'minor':
        process.env.version = major + '.' + minor;
        break;
      case 'patch':
        process.env.version = pkg.version;
        break;
    }
    grunt.task.run(['build-js', 'clear-version']);
  });

  grunt.registerTask('build-js', ['concat:ACEKurento', 'uglify:ACEKurento']);
  grunt.registerTask('default', ['build-js']);
}