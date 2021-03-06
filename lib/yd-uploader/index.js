
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter
var async = require('async');
var format = require('util').format;
var knoxClient = require('knox');
var mime = require("mime");
var fs = require("fs");

module.exports = function (options) {
    var knox = knoxClient.createClient({
            key: options.S3_KEY,
            secret: options.S3_SECRET,
            bucket: options.S3_BUCKET,
            endpoint: options.END_POINT,
            port: options.PORT || 80
        }),

        self = this;
    /**
     * upload file from -> to
     * @deprecated use uploadFile instead
     * @param from
     * @param to
     * @param cb
     * @returns {*}
     */
    this.upload = function (from, to, success, error, page) {
        var lastProgress = 0,
            put,
            headers,
            packed = false;
        if (fs.existsSync(from)) {
            headers = {
                'Content-Type': mime.lookup(from),
                'x-amz-acl': 'public-read'
            };
            if (from.substr(-4) === '.zip') {
                headers['X-Myra-Unzip'] = '1';
                packed = true;
            } else {
                delete headers['X-Myra-Unzip'];
                packed = false;
            }
            put = knox.putFile(from, to, headers, function (err, result) {
                if (!err && result && (result.statusCode === 200 || result.statusCode === 304)) {
                    console.log('\n\033[32mUploaded to: ' + options.S3_BUCKET  + to, '\033[0m\nFrom : ', from, '\nStatus : ', result && result.statusCode);
                    console.log("\n Time " + new Date().toISOString());
                    if (page.deleteAfter && fs.existsSync(page.from)) {
                        fs.unlinkSync(page.from);
                    }
                    result && result.resume();
                    success && success(page);
                } else if (page.retry && page.retry > 10) {
                    result && result.resume();
                    error && error(page.err);
                } else {
                    console.log('\n\033[31mFailed to upload file to: ' + options.S3_BUCKET + '/' + to + "\033[0m (" + (err || "") + ")");
                    console.log("\nStatus Code : ", result && result.statusCode);
                    console.log("\n\033[31m Error Time " + new Date().toISOString() + "\033[0m ");
                    console.log("\nTry again in 5 sec");
                    page.retry = page.retry ? page.retry + 1 : 1;
                    page.err = err && typeof err === "object" ? err : {};
                    if (result && result.statusCode) {
                        page.err.statusCode = result.statusCode;
                    }
                    page.err.time = new Date();
                    setTimeout(function () {
                        self.upload(from, to, success, error, page);
                    }, 5000);
                }
            });
            if (options && options.progress) {
                put.on('progress', function (result) {
                    var string = "",
                        i;
                    if (result && result.percent) {
                        for (i = 0; i < result.percent - lastProgress; i++) {
                            string += "X";
                        }
                        lastProgress = result.percent;
                        if (!process.stdout.destroyed) {
                            process.stdout.write(string);
                        }
                    }
                });
            }
        } else {
            console.log("!!!---File do not exists---!!! ", from);
            //error && error("File do not exists");
            success && success(page);
        }
        return this;
    };
    /**
     * upload content -> to
     * @param from
     * @param to
     * @param cb
     * @returns {*}
     */
    this.uploadContent = function (content, to, conf, callback) {
         var headers;
         if (!conf.type) {
             callback("Content Type is missing");
             return;
         }
         headers = {
             'Content-Length': content.length,
             'Content-Type': conf.type,
             'x-amz-acl': 'public-read'
         };

         if (conf.headers) {
             headers = _.assign(headers, conf.headers);
         }
         function upload(next) {
             var put = knox.put(to, headers);
             put.on('response', function (result) {
                 if (result.statusCode >= 400) {
                    result.resume();
                    var err = format('Failed to upload %s/%s Status: %d', options.S3_BUCKET, to, result.statusCode);
                     
                    return setTimeout(function () {
                        next(err);
                    }, 3000);
                 }
                 var statusCode = (result) ? result.statusCode : '';

                 var text = format('Uploaded to: %s/%s Status : %d', options.S3_BUCKET, to, statusCode);
                 result.resume();
                 next(null, text);
             });
             // send conetnt
             put.end(content);
         }

         async.retry(5, upload, callback);

         return this;
     };
    /**
     *
     * @param conf
     * @returns {*}
     */
    this.push = function (conf) {
        var self = this;
        setTimeout(function () {
            if (conf.content) {
                self.uploadContent(conf.content, conf.to, conf.successCb, conf.errorCb, conf);
            } else {
                self.upload(conf.from, conf.to, conf.successCb, conf.errorCb, conf);
            }
        }, 300);
        return this;
    };


    /**
     * upload file from -> to
     * @param from
     * @param to
     * @param page
     * @param callback
     * @returns {*}
     */
    this.uploadFile = function (from, to, page, callback) {
        var emitter = new EventEmitter();

        var headers = {
            'Content-Type': mime.lookup(from),
            'x-amz-acl': 'public-read'
        };
        if (from.substr(-4) === '.zip') {
            headers['X-Myra-Unzip'] = '1';
        } else {
            delete headers['X-Myra-Unzip'];
        }

        function upload(next) {
            knox.putFile(from, to, headers, function (err, result) {
                if (err || result.statusCode >= 400) {
                    if (err && err.code === 'ENOENT') {
                        return callback(err);
                    }
                    emitter.emit('retry');
                    result && result.resume();
                    return setTimeout(function () {
                        console.log('timeout is over', err);
                        next(err || format('Failed to upload %s/%s Status: %d', options.S3_BUCKET, to, result.statusCode));
                    }, 3000);

                }
                var text = format('Uploaded to: %s/%s Status : %d', options.S3_BUCKET, to, result.statusCode);

                result && result.resume();

                if (page.deleteAfter) {
                    return fs.unlink(from, function (error) {
                        next(error, text);
                    });
                }

                next(null, text);
            });
        }

        async.retry(5, upload, callback);
        return emitter;
    };

};

