'use strict';


var fs = require('fs');
var path = require('path');
var vm = require('vm');
var gt = require('gettext');

var sprintfFilename = __dirname + "/sprintf.js";
var sprintfCode = fs.readFileSync(sprintfFilename);
vm.runInThisContext(sprintfCode, sprintfFilename);



var locale = function (basePath, domain, locale, success) {
    gt.loadLanguageFile(path.join(basePath, 'locales', domain, locale, 'messages.po'), locale, function () {
        gt.setlocale('LC_ALL', locale);
        success();
    });

};

var _ = function (msgid, var1) {
    var a = arguments;
    if (var1 !== undefined) {
        a[0] = gt.gettext(msgid);
        return sprintf.apply(this, a);
    } else {
        return gt.gettext(msgid);
    }
};

var _n = function (msgid1, msgid2, n) {
    var a = arguments;
    a.shift();
    a[0] = gt.gettext(n > 1 ? msgid1 : msgid2);
    return sprintf.apply(this, a);
};

var parse = function (string, config) {
    for (var key in config) {
        global[key] = config[key];
    }
    return string
        .replace(/<%=\s*_\(\s*['"]([^'"]+)['"]\s*\)\s*%>/gm, function (_match, msgid) {
            return _(msgid);
        })
        .replace(/_\(\s*['"]([^'"]+)(['"])\s*\)/gm, function (_match, msgid, quote) {
            return quote + _(msgid) + quote;
        })
        .replace(/_\(\s*['"]([^'"]+)(['"]),\s*([^)]+)\)/gm, function (_match, msgid, quote, vars) {
            return quote + _(msgid, eval(vars)) + quote;
        })
        .replace(/_n\(\s*['"]([^'"]+)(['"]),\s*['"]([^'"]+)['"],\s*([^,)]+)(,([^)]+))?\s*\)/gm, function (_match, msgid1, quote, msgid2, n, _varskomma, vars) {
            return quote + _n(msgid1, msgid2, eval(n), eval(vars)) + quote;
        });
}

exports.locale = locale;
exports.parse = parse;
exports._ = _;
exports._n = _n;