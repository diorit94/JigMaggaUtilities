'use strict';

var async = require('async'),
    _ = require('lodash'),
    extend = require('deep-extend'),
    fs = require('fs'),
    path = require('path');


var configStorage = {};

var readConfig = function (path, callback) {
    if (configStorage[path]) {
        return process.nextTick(function () {
            callback(null, configStorage[path]);
        });
    }
    fs.readFile(path, function (err, result) {
        if (err) {
            if (err.code === 'ENOENT') {
                configStorage[path] = {};
                return callback(null, {});
            }

            return callback(err);
        }

        try {
            result = JSON.parse(result);
        } catch (e) {
            return callback('error while parsing config ' + path);
        }

        configStorage[path] = result;
        callback(null, result);
    });
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
     * @param {function} callback
     * @returns {{}}
     */
    getPageConfig: function (basePath, domain, page, callback) {

        if(_.isFunction(page)) {
            callback = page;
            page = '';
        }

        page = page || '';

        async.waterfall([
            this.getConfigPaths.bind(null, basePath, domain, page),
            function (configPaths, next) {

                async.reduce(configPaths, {}, function (extendedConfig, currentConfigPath, cb) {
                    readConfig(currentConfigPath, function (err, content) {
                        if (err) {
                            return cb(err);
                        }

                        var res = extend(extendedConfig, content);
                        cb(null, res);
                    });
                }, next);

            }
        ], callback);
    }
}