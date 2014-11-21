'use strict';
var _ = require('lodash');
var format = require('util').format;
var stream = require('./streamHelper');

var amqp = require('amqp');


var globalExchange = null;
/**
 * returns amqp channel from global variable if it was created before
 * or creates it and push to the global var
 *
 * @param  {Promise}   connection
 * @param  {Function}  callback
 */
var getChannel = function (connection, queue, callback) {
    if (queue.channelPromise && !queue.channelCanceled) {
        return queue.channelPromise.done(function (ch) {
            queue.channel = queue.channel || ch;
            callback(null, ch);
        });
    }

    connection
        .then(function (connected) {
            queue.channelPromise = connected.createChannel().then();
            queue.channelCanceled = false;
            return queue.channelPromise.then(function (ch) {
                queue.channel = ch;
                return callback(null, ch);
            });
        })
        .catch(function (err) {
            console.log(err);
           return callback(err);
        });
};


/**
 * returns a stream from a amqp queue each message from the
 * queue is throed to the stream
 * - shiftAfterReceive means whether the message should be shifted from queue just after receiving
 *   or queueShift method should be added to the message object
 * - prefetch is an amount of message that should be consumed by the amqp client without acknowledge
 *
 * @param  {{connection: Promise, exchange: string, queue: string, prefetch: number, shiftAfterReceive: boolean}} options
 * @return {Stream}
 */
var getStream = exports.getStream = function (options) {
    options = options || {};
    var duplex = stream.duplex();
    var connection = this.connection || options.connection;
    var queue = this.name || options.queue;
    var prefetch = this.options.prefetch || options.prefetch;
    var that = this;

    var queueOptions = {
        durable: true,
        autoDelete: false
    };

    var consumeQueue = function () {
        connection.queue(queue, queueOptions, function (q) {
            q.bind(that.exchangeName, queue);
            process.nextTick(function () {
                duplex.emit('ready', queue);
            });

            // Receive messages
            q.subscribe({ack: true, prefetchCount: prefetch},
            function (message, headers, deliveryInfo, ack) {
                if (!message) {
                    return;
                }
                if (_.isPlainObject(message) && !message.data) {
                    message = {
                        data: message,
                        contentType: 'text/json'
                    };
                }

                if (options.shiftAfterReceive) {
                    duplex.write(message);
                    return q.shift();
                }

                message.queueShift = ack.acknowledge.bind(ack, false);
                return duplex.write(message);
            });

        });

    };

    setTimeout(function () {
        if (_.isFunction(connection.exchange)) {
            var exc = globalExchange = connection.exchange(that.exchangeName);
            exc.on('open', function () {
                consumeQueue();
            });
        }
    }, 200);

    return duplex;
};

/**
 * module representing an amqp
 * @module amqp
 */


/**
 * publish message to queue
 *
 * @param  {*} message
 * @param  {?object} options
 */
var publish = exports.publish = function (message, options, callback) {
    options = options || {};
    var that = this;
    callback = callback || function (err) {
        if (err) {
            throw new Error(err);
        }
    };

    options.contentType = options.contentType || 'text/plain';

    message = _.isString(message) ? message : JSON.stringify(message);
    var queue = options.queue || this.name;
    delete options.queue;

    //console.log('PUBLISH');
    if (!globalExchange) {
        var exc = globalExchange = this.connection.exchange(this.exchangeName);
        return exc.on('open', function () {
            that.connection.publish(queue, message, options, callback);
        });
    }
    globalExchange.publish(queue, message, options, callback);
};


/**
 * returns amqp connection promise
 *
 * @param  {{login: string, password: string, host: string, vhost: string}} config
 * @return {Promise}
 */
exports.getConnection = function (config) {
    var credentials = config.credentials;

    var connection = amqp.createConnection({
        host: credentials.host,
        login: credentials.login,
        password: credentials.password,
        vhost: credentials.vhost,
        heartbeat: config.options.heartbeat
    }, {reconnect: true, defaultExchange: 'amq.direct'});

    connection.on('error', function (err) {
        console.log('CONNECTION ERROR');
        console.log(err);
        throw new Error(err);
    });

    return connection;
};

var QueuePool = function (queues, connection, options) {
    var that = this;
    options = options || {};

    _.each(queues, function (queue, name) {

        that[name] = {
            name: queue,
            connection: connection,
            exchangeName: options.exchangeName || 'amq.direct',
            getStream: getStream,
            publish: publish,
            options: options,
            channel: null,
            consumerTag: null
        };
    });
};

/**
 * parse message from queue to objectg
 * @param {{contentType: string, data: string|object}} data
 * @return {object}
 */
QueuePool.parseMessage = function (data) {
    var message,
        contentType = data.contentType;

    if (_.isArray(data) && data.length === 1) {
        data = data[0];
    }

    if (contentType === 'text/plain' || contentType === 'text/json') {

        message = _.isPlainObject(data.data) ?
            data.data : JSON.parse(data.data.toString('utf-8'));
    }

    return message;
};


exports.QueuePool = QueuePool;

