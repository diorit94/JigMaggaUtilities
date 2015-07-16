/*global describe, it, beforeEach: true*/

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

        beforeEach(function () {
            fsReadFileStub = sinon.stub();
            fsStub = {
                readFile: fsReadFileStub
            };

            fsReadFileStub.callsArgWithAsync(1, {code: 'ENOENT'});

            fsReadFileStub.withArgs(join(basePath, 'page.conf'))
                .callsArgWithAsync(1, null, JSON.stringify(pageConfig));

            fsReadFileStub.withArgs(join(basePath, 'default/default.conf'))
                .callsArgWithAsync(1, null, JSON.stringify(defaultConfig));

            configMerge.__set__('fs', fsStub);
            configMerge.__set__('configStorage', {});
            configMerge.__set__('fullConfigStorage', {});
        });



        it('should return merged configs', function (done) {

            configMerge.getPageConfig(basePath, domain, page, function (err, res) {
                expect(Boolean(err)).to.eql(false);

                expect(res).to.eql(extend(pageConfig, defaultConfig));
                done();
            });
        });

        it('should execute default onEnoent function if it is not setted', function (done) {

            var onEnoent = sinon.stub();
            var defaultOnEnoent = configMerge.__get__('defaultOnEnoent');
            configMerge.__set__('defaultOnEnoent', onEnoent);

            onEnoent.callsArgWithAsync(1, null, {});

            configMerge.getPageConfig(basePath, domain, page, function (err, res) {
                expect(Boolean(err)).to.eql(false);

                console.log(onEnoent.callCount);
                expect(onEnoent.called).to.eql(true);
                expect(res).to.eql(extend(pageConfig, defaultConfig));
                configMerge.__set__('defaultOnEnoent', defaultOnEnoent);
                done();
            });
        });

        it('should execute onEnoent function if it is present ', function (done) {

            var onEnoent = sinon.stub();

            onEnoent.callsArgWithAsync(1, null, {});

            configMerge.getPageConfig(basePath, domain, page, onEnoent, function (err, res) {
                expect(Boolean(err)).to.eql(false);

                console.log(onEnoent.callCount);
                expect(onEnoent.called).to.eql(true);
                expect(res).to.eql(extend(pageConfig, defaultConfig));
                done();
            });
        });

    });

    describe('#extendApiCallsWithModels', function () {
        var extendApiCallsWithModels = configMerge.__get__('extendApiCallsWithModels');

        var input = {
            jigs: {
                ".yd-jig-partnerdiscount": {
                    "controller": "Yd.Jig.Partnerdiscount",
                    "template": "yd/jig/partnerdiscount/views/init.mustache",
                    "prerender": false,
                    "render": false,
                    "includeController": true,
                    "models": ["@yd-models-restaurant#restaurant"],
                    "apicalls": {
                        "foo" : {
                            "method": "get",
                            "path": "/restaurant/{restaurantId}",
                            "predefined": true,
                            "resultSchema": "//yd/fixture/schema/restaurant.json"
                        }
                    }
                },
                "@yd-models-restaurant": {
                    "disabled": true,
                    "controller": "Yd.Models.Restaurant",
                    "mapper": "yd/models/restaurant/mapper.js",
                    "options": {},
                    "apicalls": {
                        "restaurant": {
                            "method": "get",
                            "path": "/restaurant/{restaurantId}",
                            "predefined": true,
                            "resultSchema": "//yd/fixture/schema/restaurant.json"
                        },
                        "restaurants": {
                            "method": "get",
                            "path": "/restaurants/",
                            "predefined": true,
                            "resultSchema": "//yd/fixture/schema/restaurant.json"
                        }
                    }
                }
            }
        };

        it('should extend apicalls with model referrence ', function () {
            var output = {
                jigs: {
                    ".yd-jig-partnerdiscount": {
                        "controller": "Yd.Jig.Partnerdiscount",
                        "template": "yd/jig/partnerdiscount/views/init.mustache",
                        "prerender": false,
                        "render": false,
                        "includeController": true,
                        "models": [
                            "@yd-models-restaurant#restaurant"
                        ],
                        "apicalls": {
                            "restaurant": {
                                "method": "get",
                                "path": "/restaurant/{restaurantId}",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            },
                            "foo" : {
                                "method": "get",
                                "path": "/restaurant/{restaurantId}",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            }
                        }

                    }
                },
                "models": {
                    "@yd-models-restaurant": {
                        "disabled": true,
                        "controller": "Yd.Models.Restaurant",
                        "mapper": "yd/models/restaurant/mapper.js",
                        "options": {},
                        "apicalls": {
                            "restaurant": {
                                "method": "get",
                                "path": "/restaurant/{restaurantId}",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            },
                            "restaurants": {
                                "method": "get",
                                "path": "/restaurants/",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            }

                        }
                    }
                }
            };

            expect(extendApiCallsWithModels(input)).to.eql(output);
        });
        
        it('should extend apicalls with all calls in model if no method name provided', function () {
            var input = {
                jigs: {
                    ".yd-jig-partnerdiscount": {
                        "models": ["@yd-models-restaurant"]
                    },
                    "@yd-models-restaurant": {
                        "mapper": "yd/models/restaurant/mapper.js",
                        "options": {},
                        "apicalls": {
                            "restaurant": {
                                "method": "get",
                                "path": "/restaurant/{restaurantId}",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            },
                            "restaurants": {
                                "method": "get",
                                "path": "/restaurants/",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            }
                        }
                    }
                }
            };
            var output = {
                jigs: {
                    ".yd-jig-partnerdiscount": {
                        "models": [
                            "@yd-models-restaurant"
                        ],
                        "apicalls": {
                            "restaurant": {
                                "method": "get",
                                "path": "/restaurant/{restaurantId}",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            },
                            "restaurants": {
                                "method": "get",
                                "path": "/restaurants/",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            }
                        }

                    }
                },
                "models": {
                    "@yd-models-restaurant": {
                        "mapper": "yd/models/restaurant/mapper.js",
                        "options": {},
                        "apicalls": {
                            "restaurant": {
                                "method": "get",
                                "path": "/restaurant/{restaurantId}",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            },
                            "restaurants": {
                                "method": "get",
                                "path": "/restaurants/",
                                "predefined": true,
                                "resultSchema": "//yd/fixture/schema/restaurant.json"
                            }
                        }
                    }
                }
            };

            expect(extendApiCallsWithModels(input)).to.eql(output);
        });
    });
});
