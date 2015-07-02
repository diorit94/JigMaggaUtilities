'use strict';

var async = require('async'),
    _ = require('lodash'),
    fs = require('fs'),
    path = require('path');


var configStorage = {};
var fullConfigStorage = {};

var defaultOnEnoent = function (pagePath, cb) {
    return cb(null, {});
};

var readConfig = function (pagePath, onEnoent, callback) {
    if (!_.isFunction(callback) && _.isFunction(onEnoent)) {
        callback = onEnoent;
        onEnoent = defaultOnEnoent;
    }
    onEnoent = onEnoent || defaultOnEnoent;

    if (configStorage[pagePath]) {
        return process.nextTick(function () {
            callback(null, configStorage[pagePath]);
        });
    }
    fs.readFile(pagePath, function (err, result) {
        if (err) {
            if (err.code === 'ENOENT') {
                return onEnoent(pagePath, function (err, res) {
                    if (!err) {
                        configStorage[pagePath] = res;
                    }
                    return callback(err, res);
                });
            }

            return callback(err);
        }

        try {
            result = JSON.parse(result);
        } catch (e) {
            return callback('error while parsing config ' + pagePath);
        }

        configStorage[pagePath] = result;
        callback(null, result);
    });
};

/**
 * extend config with domain-pages if them exist in the config
 *
 * @param  {object} config
 * @param  {string} basedomain
 * @return {object}
 */
var extendWithDomainPage = function (config, basedomain) {
    var result = {};

    if (basedomain.indexOf('/') >= 0) {
        basedomain = _.first(basedomain.split('/'));
    }

    if (!config['domain-pages'] || !config['domain-pages'][basedomain]) {
        return config;
    }

    result = _.merge(config, config['domain-pages'][basedomain]);
    delete result['domain-pages'][basedomain];
    return result;
};


module.exports = {
    /**
     * get list of config files that should be merged in order
     * to obtain merged config
     *
     * @param {string} basePath - should be the pass to "page" folder with configs like /path/to/ydFrontend/yd/page
     * @param {string} domain
     * @param {string} page
     * @param {function} callback
     * @return {*}
     */
    getConfigPaths: function (basePath, domain, page, callback) {
        var defaultDomainName = 'default',
            defaultPageConfigName = 'page.conf',
            configs;

        if(_.isFunction(page)) {
            callback = page;
            page = '';
        }

        function getPossibleConfigsForDomain(domain, page) {
            var fullPath = path.join(domain, page),
                currentPath = basePath;

            return fullPath.split('/').map(function (folder) {
                currentPath = path.join(currentPath, folder);
                return path.join(currentPath, folder + '.conf');
            });
        }

        configs = getPossibleConfigsForDomain(defaultDomainName, page)
            .concat(getPossibleConfigsForDomain(domain, page));

        configs.unshift(path.join(basePath, defaultPageConfigName));

        callback(null, configs);
    },

    /**
     * get the page conf and all configs that will above this page config
     * will be return extended object
     *
     * @param {string} basePath - should be the pass to "page" folder with configs like /path/to/ydFrontend/yd/page
     * @param {string} domain
     * @param {string} page
     * @param {function} onEnoent
     * @param {function} callback
     * @returns {{}}
     */
    getPageConfig: function (basePath, domain, page, onEnoent, callback) {

        if(_.isFunction(page)) {
            callback = onEnoent;
            onEnoent = page;
            page = '';
        }

        if(!_.isFunction(callback) && _.isFunction(onEnoent)) {
            callback = onEnoent;
            onEnoent = null;
        }

        var cacheKey = domain + page;

        if (fullConfigStorage[cacheKey]) {
            return process.nextTick(function () {
                callback(null, fullConfigStorage[cacheKey]);
            });
        }

        page = page || '';

        async.waterfall([
            this.getConfigPaths.bind(null, basePath, domain, page),
            function (configPaths, next) {


                async.reduce(configPaths, {}, function (extendedConfig, currentConfigPath, cb) {
                    readConfig(currentConfigPath, onEnoent, function (err, content) {
                        if (err) {
                            return cb(err);
                        }

                        var res = _.merge(extendedConfig, content);
                        cb(null, res);
                    });
                }, next);

            }
        ], function (err, res) {
            if (err) {
                return callback(err);
            }

            fullConfigStorage[cacheKey] = extendWithDomainPage(res, domain);

            callback(null, fullConfigStorage[cacheKey]);
        });
    }
};
