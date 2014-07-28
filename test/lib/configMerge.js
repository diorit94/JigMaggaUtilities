/*global describe, it, before: true*/

'use strict';

var join = require('path').join,
    expect = require('chai').expect,
    extend = require('deep-extend'),
    rewire = require('rewire'),
    sinon = require('sinon');

var configMerge = rewire('../../lib/configMerge');


describe('configMerge', function () {
    var fsStub = {},
        basePath = '/foo/bar/qaz';
    describe('#getConfigPaths', function () {

        it('should return all possible paths if all config files exists', function (done) {
            var domain = 'liefrando.de',
                page = 'menu';

            configMerge.getConfigPaths(basePath, domain, page, function (err, res) {
                expect(err).to.eql(null);

                expect(res).to.be.an('array');
                expect(res).to.eql([
                    join(basePath, 'page.conf'),
                    join(basePath, 'default/default.conf'),
                    join(basePath, 'default', page, page + '.conf'),
                    join(basePath, domain, domain + '.conf'),
                    join(basePath, domain, page, page + '.conf')
                ]);
                done();
            });
        });

        it('should works without page param', function (done) {
            var domain = 'liefrando.de';


            configMerge.getConfigPaths(basePath, domain, function (err, res) {
                expect(err).to.eql(null);

                expect(res).to.be.an('array');
                expect(res).to.eql([
                    join(basePath, 'page.conf'),
                    join(basePath, 'default/default.conf'),
                    join(basePath, domain, domain + '.conf')
                ]);
                done();
            });
        });

    });

    describe('#getPageConfig', function () {
        var defaultConfig = {a: 1, b: {c: 'foo'}},
            pageConfig = {a:3, c: 42, b: {foo: 'bar'}},

            domain = 'satellites.lieferando.de/google.com',
            page = 'menu',
            fsReadFileStub;

        before(function () {
            fsReadFileStub = sinon.stub();
            fsStub = {
                readFile: fsReadFileStub
            };

            configMerge.__set__('fs', fsStub);
        });


        it('should return merged configs', function (done) {

            fsReadFileStub.callsArgWithAsync(1, {code: 'ENOENT'});

            fsReadFileStub.withArgs(join(basePath, 'page.conf'))
                .callsArgWithAsync(1, null, JSON.stringify(pageConfig));

            fsReadFileStub.withArgs(join(basePath, 'default/default.conf'))
                .callsArgWithAsync(1, null, JSON.stringify(defaultConfig));


            configMerge.getPageConfig(basePath, domain, page, function (err, res) {
                expect(Boolean(err)).to.eql(false);

                expect(res).to.eql(extend(pageConfig, defaultConfig));
                done();
            });
        });

    });
});
