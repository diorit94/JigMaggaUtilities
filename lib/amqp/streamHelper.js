'use strict';

var es = require('event-stream');
var _ = require('lodash');


module.exports = {
    /**
     * filter message in stream by predicate
     * 
     * @param  {function} predicate
     * @return {Duplex}
     */
    filter: function (predicate) {
        var isAsync = (predicate.length === 2);

        if (!isAsync) {
            return es.through(function (data) {
                try {
                    if (predicate.call(this, data)) {
                        this.emit('data', data);
                    }
                } catch (e) {
                    this.emit('error', e);
                }
            });
        }

        return es.map(function (data, callback) {
            predicate(data, function (err, res) {
                if (err) {
                    return callback(err);
                }
                if (res) {
                    return callback(null, data);
                }
                callback();
            });
        });
    },


    /**
     * create a duplex stream that obtain message and emit it to consumer
     * 
     * @return {Duplex}
     */
    duplex: function () {
        return es.through(
            function (data) {
                this.emit('data', data);
            },
            function () {
                this.emit('end');
            });
    },

    /**
     * returns stream that collect all messages in a buffer
     * and emit one accumulated message when the end event 
     * is fired 
     * 
     * @param  {Function} callback
     */
        accumulate: function (callback) {
        var buffers = [];

        return es.through(function write(data) {
            if (!Buffer.isBuffer(data)) {
                data = _.isString(data) ? data : JSON.stringify(data);
                data = new Buffer(data);
            }
            buffers.push(data);
        }, function end() {
            var result = Buffer.concat(buffers);
            buffers = [];
            var that = this;

            callback.call(that, null, result, function () {
                that.emit('end');
            });
        });
    },
    /**
     * wrap streams and add an error listener  for each of them
     * 
     * @param  {string} eventName event to listen
     * @return {stream}
     */
    tryCatch: function (eventName) {
        var streams = [];
        eventName = eventName || 'error';

        var tryCatch = function (stream) {
            streams.push(stream);
            return stream;
        };

        tryCatch.catch = function (handler) {
            _.each(streams, function (stream) {
                stream.on(eventName, handler);
            });
        };

        return tryCatch;
    }
};