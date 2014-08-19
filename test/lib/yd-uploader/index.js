/*global describe, it, beforeEach, afterEach: true*/
'use strict';

var EventEmitter = require('events').EventEmitter,
    expect = require('chai').expect,
    rewire = require('rewire'),
    sinon = require('sinon');


var Uploader = rewire('../../../lib/yd-uploader/index');

var options = {
    'S3_KEY': 'foo',
    'S3_SECRET': 'bar',
    'S3_BUCKET': 'foo',
    'END_POINT': 'bar',
};

describe('Uploader', function () {
    var put = new EventEmitter();
    var knox ={
            put: function () {
                return put;
            }
        };

    var knoxClient = {
        createClient: function () {
            return knox;
        }
    };
    describe('#uploadContent', function () {
        var uploader;
        var content = 'Hello World',
            to = '/foo/bar',
            conf = {type: 'text/plain'};
        

        beforeEach(function () {
            put.end = sinon.spy();
            Uploader.__set__('knoxClient', knoxClient);
            uploader = new Uploader(options);
        });

        it('should return success in callback if result successCode is less then 400', function (done) {
                var response = {
                    statusCode: 200,
                    resume: sinon.spy()
                };

            uploader.uploadContent(content, to, conf, function (err, res) {
                expect(err).to.eql(null);
                expect(res).to.contain(to);
                expect(put.end.called).to.eql(true);
                expect(put.end.getCall(0).args[0]).to.eql(content);
                expect(response.resume.called).to.eql(true);

                done();
            });
            put.emit('response', response);
        });

        it('should retry to send a request if the response was with error statusCode', function (done) {
            var errorResponse = {
                statusCode: 400,
                resume: sinon.spy()
            };

            var successResponse = {
                statusCode: 200,
                resume: sinon.spy()
            };
            var clock = sinon.useFakeTimers();

            uploader.uploadContent(content, to, conf, function (err, res) {
                expect(err).to.eql(null);
                expect(res).to.contain(to);
                expect(put.end.called).to.eql(true);
                expect(errorResponse.resume.called).to.eql(true);
                expect(successResponse.resume.called).to.eql(true);

                done();
            });
            put.emit('response', errorResponse);
            clock.tick(3500);
            clock.restore();
            process.nextTick(function () {
                put.emit('response', successResponse);                
            });
        });
    });
    
    describe('#uploadFile', function () {
        var fs = {
            unlink: sinon.stub()
        };

        var mime = {
            lookup: function () {
                return 'text/plan';
            }
        };

        var knox = {
            putFile: sinon.stub()
        };

        var knoxClient = {
            createClient: function () {
                return knox;
            }
        };
        var fileName = '/foo/bar/archive.zip',
            uploader;

        beforeEach(function () {
            Uploader.__set__('fs', fs);
            Uploader.__set__('mime', mime);
            Uploader.__set__('knoxClient', knoxClient);

            uploader = new Uploader(options);
        });

        var successResponse = {
            statusCode: 200,
            resume: sinon.spy()
        };

        afterEach(function () {
            successResponse.resume = sinon.spy();
        });

        it('should upload a file and return success', function (done) {
            knox.putFile.callsArgWithAsync(3, null, successResponse);

            uploader.uploadFile(fileName, '/foo/bar', {}, function (err, res) {
                expect(err).to.eql(null);
                expect(res).to.contain(successResponse.statusCode);
                expect(successResponse.resume.called).to.eql(true);
                done();
            });
        });

        it('should execute unlink command and delete file if deleteAfter options was set', function (done) {
            knox.putFile.callsArgWithAsync(3, null, successResponse);
            fs.unlink.callsArgWithAsync(1, null);

            uploader.uploadFile(fileName, '/foo/bar', {deleteAfter: true}, function (err, res) {
                expect(err).to.eql(null);
                expect(res).to.contain(successResponse.statusCode);
                expect(successResponse.resume.called).to.eql(true);
                expect(fs.unlink.called).to.eql(true);
                expect(fs.unlink.getCall(0).args[0]).to.eql(fileName);
                
                done();
            });
        });
    });
});