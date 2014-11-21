'use strict';

var _ = require('lodash');
var winston = require('winston');

/**
 * capitalize first letter
 * @param {String} word
 * @return {String}
 */
var capitalFirst = function (word) {
    return  word.charAt(0).toUpperCase() + word.substr(1, word.length);
};

var loggers = {};

/**
 *
 * @param {string} component
 * @param {{colors: object, customLevels: object, console: object, transports: object}} config
 * @param {object} logLevels
 * @return {*}
 */
var getLogger = function (component, config, logLevels) {
    if (loggers[component]) {
        return loggers[component];
    }

    //extend default winston colors with custom
    var colors = _.assign(winston.config.cli.colors, config.colors);

    winston.addColors(colors);

    var logger = new (winston.Logger)({
        levels: logLevels,
        transports: [
            new (winston.transports.Console)(config.console)
        ]
    });

    if (config.transports && _.isObject(config.transports)) {
        _.each(config.transports, function (options, transportName) {
            var className = capitalFirst(transportName);

            if (winston.transports[className]) {
                require(options.moduleName);
                logger.add(winston.transports[className], options);
            }
        });
    }

    loggers[component] = logger;

    return logger;
};

/**
 * returns a log function for current component
 * metadata if passed is added to each log message
 *
 * @param  {string} component
 * @param  {object} metadata
 * @param  {{customLevels: object, defaultLogLevel: string, console: {level: string}}} config
 * @return {function}
 */
module.exports = function (component, metadata, config) {
    metadata = metadata || {};

    //extend default winston log levels with custom
    var logLevels = _.assign(winston.config.cli.levels, config.customLevels);


    if (_.contains(process.argv, '-v') || _.contains(process.argv, '--verbose')) {
        config.console.level = config.defaultLogLevel;
    }

    var logger = getLogger(component, config);


    /**
     * first argument could be one of the log levels
     * like:
     *   silly
     *   input
     *   verbose
     *   prompt
     *   debug
     *   info
     *   data
     *   help
     *   warn
     *   error
     *   success
     *   fail
     *
     * if the first argument is not one of those string it used like log message.
     * log level in this case is 'verbose'
     * @example
     * log('verbose', 'foo bar');
     * is the same as
     * log('foo bar');
     *
     * If the last argument is the object it's perceived like a metadata
     * all other arguments could be used like in util.format function
     *
     * @example
     * log('foo %d foo %s', 1, 'bar') // foo 1 foo bar, metadata = {}
     *
     * but if you want to insert an object in to string you have to add some additional empty object
     * in order to prevent the usage of your object like a metadata
     *
     * @example
     * //wrong
     * log('foo: %j', {a: 1}) // 'foo %j', metadata = {a: 1}
     * //correct
     * log('foo: %j', {a: 1}, {}) // 'foo {a: 1}', metadata = {}
     *
     * function will do nothing in test environment in order to not print anything while tests are running
     */
    return function () {
        if (process.env.NODE_ENV === 'silent') {
            return;
        }
        var args = _.toArray(arguments);
        var meta = args.pop();

        if (_.isPlainObject(meta)) {
            meta = _.assign(meta, metadata);
            args.push(meta);
        } else {
            args.push(meta);
            args.push(metadata);
        }

        if (!_.contains(_.keys(logLevels), args[0])) {
            args.unshift(config.defaultLogLevel);
        }

        logger.log.apply(logger, args);
    };

};
