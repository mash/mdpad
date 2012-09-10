
/*!
 * Connect - directory
 * Copyright(c) 2011 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * MIT Licensed
 */

/**
 * Module dependencies.
 */

var fs = require('fs')
  , parse = require('url').parse
  , utils = require('../../node_modules/express/node_modules/connect/lib/utils')
  , path = require('path')
  , normalize = path.normalize
  , extname = path.extname
  , md = require('github-flavored-markdown')
  , strftime = require('strftime')
  , bytes = require('bytes')
  , ago = require('../ago.js')
  , join = path.join;

/**
 * Directory:
 *
 * Serve directory listings with the given `root` path.
 *
 * Options:
 *
 * @param {String} root
 * @param {Object} options
 * @return {Function}
 * @api public
 */

exports = module.exports = function directory(root, options){
  options = options || {};

  // root required
  if (!root) throw new Error('directory() root path required');
  var hidden = options.hidden
    , root = normalize(root)
    , tryMarkdownFilesSuffix = [ '', '.markdown', '.mkdn', '.md' ]; // try these in series if not found

  return function directory(req, res, next) {
    if ('GET' != req.method && 'HEAD' != req.method) return next();

    req.tryMarkdownFilesIndex = (req.hasOwnProperty("tryMarkdownFilesIndex")) ? req.tryMarkdownFilesIndex++ : 0;

    var accept = req.headers.accept || 'text/plain'
      , url = parse(req.url)
      , dir = decodeURIComponent(url.pathname + tryMarkdownFilesSuffix[req.tryMarkdownFilesIndex])
      , path = normalize(join(root, dir))
      , originalUrl = parse(req.originalUrl)
      , originalDir = decodeURIComponent(originalUrl.pathname)
      , showUp = path != root && path != root + '/';

    // null byte(s), bad request
    if (~path.indexOf('\0')) return next(utils.error(400));

    // malicious path, forbidden
    if (0 != path.indexOf(root)) return next(utils.error(403));

    // check if we have a directory
    fs.stat(path, function(err, stat){
      if (err) {
        if ('ENOENT' == err.code) {
          // check if files with common markdown suffixes exist
          if (req.tryMarkdownFilesIndex==(tryMarkdownFilesSuffix.length-1)) {
            return next();
          }
          req.tryMarkdownFilesIndex ++;
          return directory( req, res, next );
        } else {
          return next(err);
        }
      }

      if (stat.isDirectory()) {
        // fetch files
        fs.readdir(path, function(err, files){
            if (err) return next(err);
            files = removeHidden(files);
            files = makeFileArray(path, files, dir);
            var f = files.filter(function (a) { return  a[2].isDirectory(); }),
                d = files.filter(function (a) { return !a[2].isDirectory(); });

            res.render('directory', {
                files: f.concat(d),
                strftime: strftime,
                bytes: bytes,
                ago: ago,
                paths: makePathArray(dir)
            });
        });
      } else {
        if (req.query.hasOwnProperty('raw') || req.headers.accept === '*/*') {
            res.sendfile(path);
        } else {
            if (path.match(/\.(md|mkdn)$/)) {
                var src = fs.readFileSync(path, 'utf-8');
                var html = md.parse(src);
                var title = (function () {
                    var m = html.match(/<h1>([^<>]+)<\/h1>/);
                    if (m) {
                        return m[1];
                    } else {
                        return 'no title';
                    }
                })();
                res.render('md', { html: html, title: title, paths: makePathArray(req.path) });
            } else if (path.match(/\.(png|bmp|jpg|jpeg|gif)$/)) {
                res.render('img', { path: req.path, paths: makePathArray(req.path) });
            } else {
                fs.stat(path, function (err, stats) {
                    if (err) return next(err);
                    if (stats.size < 2*1000*1000) {
                        fs.readFile(path, 'utf-8', function (err, data) {
                            if (err) return next(err);
                            var title = '';
                            res.render('file', { body: data, title: title, paths: makePathArray(dir) });
                        });
                    } else {
                        res.render('largefile', { size: stats.size, title: path, paths: makePathArray(dir) });
                    }
                });
            }
        }
      }
    });
  };
};

function makePathArray(dir) {
    var curr = [];
    var dirs = dir.split('/');
    return dirs.map(function (part) {
        curr.push(part);
        return [curr.join('/'), part, curr.length!==dirs.length];
    });
}

function makeFileArray(path, files, dir) {
    return files.map(function (file) {
        return [
            join(dir, file),
            file,
            fs.statSync(join(path, file))
        ];
    });
}

/**
 * Filter "hidden" `files`, aka files
 * beginning with a `.`.
 *
 * @param {Array} files
 * @return {Array}
 * @api private
 */
function removeHidden(files) {
    return files.filter(function(file){
        return '.' != file[0];
    });
}
