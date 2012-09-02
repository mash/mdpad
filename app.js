var express = require('express')
  , md = require('github-flavored-markdown')
  , fs = require('fs')
  , directory = require('./middleware/directory.js')
  , http = require('http')
  , path = require('path');

var app = express();

var docdir;
if (process.argv.length===3) {
    docdir = path.normalize(path.resolve(process.argv[2]));
} else {
    console.log("Usage: node app.js docdir");
    process.exit();
}
console.log("Path: " + docdir);

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(function (req, res, next) {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(require('less-middleware')({ src: __dirname + '/public' }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(directory(docdir));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
