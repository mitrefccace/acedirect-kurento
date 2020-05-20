module.exports = function(config) {
  config.set({

    // base path, that will be used to resolve files and exclude
    basePath: './',

    frameworks: ['jasmine'],

    exclude: [
    ],

    // test results reporter to use
    reporters: ['spec', 'coverage'],

    preprocessors: {
      // source files, that you wanna generate coverage for
      'src/ACEKurento.js': ['coverage']
    },

    coverageReporter: {
      type : 'html',
      dir : 'coverage/'
    },

    port: 8000,

    colors: true,

    logLevel: config.LOG_INFO,

    autoWatch: true,

    browsers: ['Chrome_without_security'],

    // custom flags for accepting media automatically
    customLaunchers: {
      Chrome_without_security: {
        base: 'Chrome',
        flags: ['--disable-web-security','--allow-running-insecure-content']
      },
      Firefox_autoaccept_media: {
        base: 'Firefox',
        prefs: {
          'media.navigator.permission.disabled': true
        }
      }
    },

    captureTimeout: 90000,

    reportSlowerThan: 3000,

    stopOnFailure: true,

    // Continuous Integration mode
    // if true, it capture browsers, run tests and exit
    singleRun: true
  });
};