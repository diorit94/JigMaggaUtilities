/*global describe, it, before, beforeEach: true*/

'use strict';

var expect = require('chai').expect,
    rewire = require('rewire'),
    sinon = require('sinon');

var logger = rewire('../../lib/logger');


var addTransportSpy = sinon.spy();
var winstonMock = {
    config: {
        cli: {
            colors: {blue: 1},
            levels: {info: 1, alert: 2}
        }
    },
    transports: {
        Console: sinon.spy()
    },
    addColors: sinon.spy(),
    Logger: function () {
        this.bar = 'foo';
        this.add = addTransportSpy;
    }
};


describe('logger', function () {
    describe('#getLogger', function () {
        var getLogger;
        beforeEach(function () {
            logger.__set__('winston', winstonMock);
            logger.__set__('loggers', {});
            getLogger = logger.__get__('getLogger');
        });

        it('should create logger instance with one transport', function () {
            var log = getLogger('foo', {colors: {}});
            expect(winstonMock.transports.Console.called).to.eql(true);
            expect(winstonMock.addColors.called).to.eql(true);
            expect(logger.__get__('loggers')).to.have.property('foo');
            expect(log.bar).to.eql('foo');
        });

        it('should create logger instance with one transport and extend standard colors', function () {
            var log = getLogger('foo', {colors: {red: 2}});
            expect(winstonMock.addColors.called).to.eql(true);
            expect(winstonMock.addColors.lastCall.args[0]).to.include.keys('red', 'blue');
            expect(log.bar).to.eql('foo');
        });

        it('should add transport if there is some in config. require should run only ones', function () {
            var transport = {
                winstonBla: {
                    moduleName: 'winston-bla',
                    level: 5
                }
            };
            winstonMock.transports.WinstonBla = 'foo';
            var requireSpy = sinon.spy();

            logger.__set__('require', requireSpy);
            logger.__set__('winston', winstonMock);

            var log = getLogger('foo', {colors: {}, transports: transport});

            expect(log.add.called).to.eql(true);
            expect(log.add.lastCall.args[0]).to.eql(winstonMock.transports.WinstonBla);
            expect(log.add.lastCall.args[1]).to.eql(transport.winstonBla);

            expect(requireSpy.called).to.eql(true);
            expect(requireSpy.lastCall.args[0]).to.eql(transport.winstonBla.moduleName);

            expect(log.bar).to.eql('foo');

            var log2 = getLogger('foo', {colors: {}, transports: transport});

            expect(log2).to.eql(log);
            expect(requireSpy.callCount).to.eql(1);

            logger.__set__('require', require);
        });
    });
});

