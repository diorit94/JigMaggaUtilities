'use strict';
var _ = require('lodash');
var querystring = require('querystring');
var format = require('util').format;
var stream = require('./streamHelper');
var domain = require('domain');

var amqplib = require('amqplib');


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

    var dom = domain.create();
    dom.on('error', function (err) {
        console.log('CONNECTION ERROR', connection);
        throw new Error(err);
    });
    connection
        .then(function (connected) {
            dom.add(connected);
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
 * module representing an amqp
 * @module amqp
 */

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
    // options.exchange = options.exchange || 'amq.direct';

    getChannel(connection, this, function (err, channel) {
        if (err) {
            throw new Error(err);
        }
        var ok = channel.assertQueue(queue, {durable: true});
        if (prefetch) {
            ok = ok.then(function () {
                channel.prefetch(prefetch);
            });
        }

        ok = ok.then(function () {
            duplex.emit('ready', queue);
            channel.on('close', function () {
                console.log('CHANNEL IS CLOASING');
            });

            channel.on('error', function (err) {
                throw new Error(err);
            });

            channel.consume(queue, function (message) {
                if (!message) {
                    return;
                }

                if (options.shiftAfterReceive) {
                    duplex.write(message);
                    return channel.ack(message);
                }

                message.queueShift = channel.ack.bind(channel, message);
                return duplex.write(message);
            }).then(function (res) {
                that.consumerTag = res.consumerTag;
            });

        });
    });

    return duplex;
};

var cancelStream = function (callback) {
    if (!this.channel || !this.consumerTag) {
        throw new Error('can not destroy stream before it is ready to consume');
    }
    var that = this;

    this.channel.cancel(this.consumerTag)
        .then(function (ok) {
            that.channel = null;
            that.channelCanceled = true;

            callback(null, ok);
        }, callback);
};

/**
 * publish message to queue
 *
 * @param  {*} message
 * @param  {?object} options
 * @param  {function} callback
 */
var publish = function (message, options, callback) {
    options = options || {};
    callback = callback || function (err) {
        if (err) {
            throw new Error(err);
        }
    };
    options.contentType = options.contentType || 'text/plain';

    message = _.isString(message) ? message : JSON.stringify(message);
    var queue = options.queue || this.name;
    delete options.queue;

    getChannel(this.connection, this, function (err, channel) {
        if (err) {
            return callback(err);
        }
        var ok = channel.assertQueue(queue, {durable: true});
        return ok.then(function () {
            message = new Buffer(message);
            return channel.sendToQueue(queue, message, options);
        }).then(function (res) {
            callback(null, res);
        }, function (err) {
            callback(err);
        });
    });
};


/**
 * returns amqp connection promise
 *
 * @param  {{login: string, password: string, host: string, vhost: string}} config
 * @return {Promise}
 */
exports.getConnection = function (config) {
    var credentials = config.credentials;

    var amqpUrl = format('amqp://%s:%s@%s/%s',
        credentials.login, credentials.password, credentials.host, credentials.vhost);
    if (config.options) {
        amqpUrl += '?' + querystring.stringify(config.options);
    }

    console.log('------[amqpUrl]', amqpUrl);
    return amqplib.connect(amqpUrl);
};

var QueuePool = function (queues, connection, options) {
    this.connection = connection;
    this.options = options || {};

    _.each(queues, this.addQueue.bind(this));
};

/**
 * add queue to the pool
 * @param {string} realQueueName - name of the queue in rabbit
 * @param {string} queuePoolName - name of the queue in pool
 * @param {object} options
 */
QueuePool.prototype.addQueue = function (realQueueName, queuePoolName, options) {
    options = options || this.options || {};
    queuePoolName = queuePoolName || realQueueName;

    this[queuePoolName] = {
        name: realQueueName,
        connection: this.connection,
        getStream: getStream,
        cancelStream: cancelStream,
        publish: publish,
        options: options,
        channel: null,
        consumerTag: null
    };
};

/**
 * parse message from queue to object
 * @param {{properties: {contentType: string}, content: string|object}} data
 * @return {object}
 */
QueuePool.parseMessage = function (data) {
    var message,

        contentType = data.properties.contentType;

    if (_.isArray(data) && data.length === 1) {
        data = data[0];
    }

    if (contentType === 'text/plain' || contentType === 'text/json') {

        message = _.isPlainObject(data.content) ?
            data.content : JSON.parse(data.content.toString('utf-8'));
    }

    return message;
};

exports.QueuePool = QueuePool;

