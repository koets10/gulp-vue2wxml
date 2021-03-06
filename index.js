
var path = require('path');
var fs = require('fs');
var compiler = require('vue-template-compiler');
var through = require('through2');
var sass = require('node-sass');

module.exports = function () {
    return through.obj(function(file, enc, callback) {
        var self = this;
        var compiledContent = compiler.parseComponent(file.contents.toString());
        var f = path.parse(file.path);

        var jsFile = file.clone();
        jsFile.contents = new Buffer(compiledContent.script.content);
        jsFile.path = path.join(f.dir, f.name + '.js');
        self.push(jsFile);

        var cssFile = file.clone();
        var styles = compiledContent.styles;
        if (styles && styles.length) {
            var onlyStyle = styles[0];
            cssFile.contents = new Buffer(onlyStyle.content);
            if (onlyStyle.lang === 'scss') {
                var result  = sass.renderSync({
                    data: onlyStyle.content,
                    importer: function (url, prev, done) {
                        if (url.indexOf('./') >= 0) {
                            if (prev === 'stdin') {
                                prev = cssFile.path;
                            }
                            return {
                                file: path.resolve(path.dirname(prev), url + '.scss')
                            };
                        } else if (url.indexOf('~') === 0) {
                            url = url.slice(1).split('/');
                            var modulePath = path.dirname(require.resolve(url[0] + '/package.json'));
                            url[0] = modulePath;

                            return {
                                file: url.join('/') + '.scss'
                            };
                        }
                    }
                });
                cssFile.contents = new Buffer(result.css);
            }
            cssFile.path = path.join(f.dir, f.name + '.wxss');
            self.push(cssFile);
        }

        var htmlFile = file.clone();
        htmlFile.contents = new Buffer(compiledContent.template.content);
        htmlFile.path = path.join(f.dir, f.name + '.wxml');
        self.push(htmlFile);

        var configFile = file.clone();
        var others = compiledContent.customBlocks;
        if (others && others.length) {
            others.forEach(function (item) {
                if (item.type === 'config') {
                    var configContent = item.content.replace(/[\n\r]+/g, '');
                    var tempFunc = new Function('return ' + configContent + ';');
                    configFile.contents = new Buffer(
                        (JSON.stringify(tempFunc()))
                    );
                    configFile.path = path.join(f.dir, f.name + '.json');
                    self.push(configFile);
                }
            });
        }
        callback();
    });
};
