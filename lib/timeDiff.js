'use strict';


var TimeDiff = function (log, options) {
    this._log = log;
    this._options = options;
};

var diffToTime = function (diff) {
    var sec = diff[0] * 1000,
        msec = Math.round(diff[1] / 1000000);

    if (sec === 0) {
        return msec;
    }

    return sec + msec;
};

TimeDiff.prototype.create = function(prefix) {
    var that = this;

    return {
        prefix: prefix,
        diff: process.hrtime(),
        stop: function () {
            if (process.env.NODE_ENV === 'test') {
                return;
            }
            var diff = process.hrtime(this.diff);
            var time = diffToTime(diff);
            that._log('time diff in msec: %d', time, {timediff: true, diff: time, prefix: prefix});
        }
    };
};

TimeDiff.diffToTime = diffToTime;

module.exports = TimeDiff;
