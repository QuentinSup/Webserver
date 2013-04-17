
// Core libs
var http 			= require('http');
var url  			= require('url');
var path  			= require('path');
var qs  			= require('querystring');
var fs  			= require('node-fs');

// Other libs
//https://github.com/marak/colors.js/
var colors  	    = require('colors');
//https://github.com/Gagle/Node-Properties
var properties  	= require('properties');
//https://github.com/broofa/node-mime
var mime			= require('mime');
//https://github.com/flatiron/winston
var winston			= require('winston');
//http://lesscss.org/
var less			= require('less');
var lessParser 		= new(less.Parser);
//http://coffeescript.org/documentation/docs/coffee-script.html
var coffee			= require('coffee-script');

colors.setTheme({
	info 	: 'green',
	data 	: 'grey',
	help 	: 'cyan',
	warn 	: 'yellow',
	debug 	: 'blue',
	error 	: 'red'
});

/**
* Check if this route matches `path`, if so
* populate `params`.
*
* @param {object} route
* @param {string} path
* @return {array}
* @api private
*/

var routeMatch = function(route, path, params){
	var qsIndex = path.indexOf('?')
	, pathname = ~qsIndex ? path.slice(0, qsIndex) : path
	, m = route._regexp.exec(pathname);

	params = params || {};

	if (m) {

		for (var i = 1, len = m.length; i < len; ++i) 
		{
			var key = route._keys[i - 1];

			var val = 'string' == typeof m[i]
			? decodeURIComponent(m[i])
			: m[i];

			if (key) {
				params[key.name] = undefined !== params[key.name]
				  ? params[key.name]
				  : val;
			} else {
				params.push(val);
			}
		}
		return true;

	}

	return false;
};

/**
* Normalize the given path string,
* returning a regular expression.
*
* An empty array should be passed,
* which will contain the placeholder
* key names. For example "/user/:id" will
* then contain ["id"].
*
* @param  {String|RegExp|Array} path
* @param  {Boolean} sensitive
* @param  {Boolean} strict
* @return {Route}
* @api private
*/

var hashRoutePath = function(path, sensitive, strict) {
	var keys = [];
	if (path instanceof RegExp) return path;
	if (path instanceof Array) path = '(' + path.join('|') + ')';
	path = path
	  .concat(strict ? '' : '/?')
	  .replace(/\/\(/g, '(?:/')
	  .replace(/(\/)?(\.)?:(\w+)(?:(\(.*?\)))?(\?)?/g, function(_, slash, format, key, capture, optional){
	    keys.push({ name: key, optional: !! optional });
	    slash = slash || '';
	    return ''
	      + (optional ? '' : slash)
	      + '(?:'
	      + (optional ? slash : '')
	      + (format || '') + (capture || (format && '([^/.]+?)' || '([^/]+?)')) + ')'
	      + (optional || '');
	  })
	  .replace(/([\/.])/g, '\\$1')
	  .replace(/\*/g, '(.*)');
	return {
		route   : path,
		_regexp : new RegExp('^' + path + '$', sensitive ? '' : 'i'),
		_keys   : keys,
		match 	: function(path, params) {
			return routeMatch(this, path, params);
		}
	}
};

exports = server = {};

_serverConfiguration = {};
_controllers = {};

var register = function(name, obj) {
	_controllers[name] = obj;
};

var get = function(name) {
	return _controllers[name];
};

var run = function(params, response, request) {
	_controllers[params.controller].run(response, request, params);
};

server.config = {};
server.controllers = {
	register: register,
	get: get,
	run: run,
	getAll: function() {
		return _controllers;
	}
};
server.application = application = {};


server.quickr = function(response, statusCode, data, mimeType) {
	try {
		mimeType = mimeType || 'text/plain';
		response.writeHead(statusCode, {'Content-Type': mimeType });
		response.end(data);
	} catch(exception) {
		server.echo('# Unable to return response > '.error, exception);	
		// 500 Internal Server Error
		response.writeHead(500);
		response.end();
	}
};

// Make server.echo an alias of console.log
server.echo = function() {
	var args = arguments;
	var self = this;
	setTimeout(function() {
		console.log.apply(self, args);
		if(self.info) {
			for(var i = 0, len = args.length; i < len; i++) {
				if(typeof(args[i]) === 'string') {
					args[i] = args[i].stripColors;
				}
			};
			self.info.apply(self, args);
		}
	}, 0);
}

// Check if fileExtension is accepted by server
server.isAuthorizedExtension = function(fileExtension) {
	var filesArray 		= this.config.files.split(' ');
	for(var i = 0, length = filesArray.length; i < length; i++) {					
		if((filesArray[i] != ' ') && (fileExtension == filesArray[i].toLowerCase())) {
			return true;
		}
	}
	return false;
};


// Routes
server.routes = _routes = [];
_routes.push(hashRoutePath('/:controller/', false, false));
_routes.push(hashRoutePath('/:controller/:action/:id', false, false));


var getRoutePathParameters = function(pathname) {
	var params = {};
	for(var i = 0, len = server.routes.length; i < len; i++) {
		var isMatched = server.routes[i].match(pathname, params);
		if(isMatched) {
			return params;
		}
	}
	return null;
};

// Run server

var run = function(conf) {

	http.createServer(function (req, res) {

		var urlParsed = url.parse(req.url, true);
		var pathname  = urlParsed.pathname;
		var queryData = '';

		req.path = urlParsed;

		req.on('data', function(data) {
            queryData += data;
            if(queryData.length > 1e6) {
                queryData = "";
                res.writeHead(413, {'Content-Type': 'text/plain'});
                req.connection.destroy();
            }
        });

        req.on('end', function() {
            req.data = qs.parse(queryData);
        
		    if(pathname == '/') {
		    	pathname += conf.root;
		   	}

	    	// Load resource
			if(pathname.lastIndexOf('.') == -1) {

				var params = getRoutePathParameters(pathname);

				if(params != null && params.controller) {
					// Call a controller
					try {
						require(path.join(conf.baseDir, 'controllers', params.controller + '.njs'));
						server.controllers.run(params, res, req);
					} catch(exception) {
						// 500 Internal Server Error
						server.quickr(res, 500);
						server.echo('# Unable to run controller : '.error + controllerName);
						server.echo(exception);
					}
				} else {
		            // 404 (FILE_NOT_FOUND)
		            server.quickr(res, 404, 'FILE_NOT_FOUND');
		            server.echo('# Controller ' + 'not found '.error + conf.baseDir + pathname);
				}
			} else {
				var fileExtension 	= pathname.substr(pathname.lastIndexOf('.') + 1).toLowerCase();
				if(!server.isAuthorizedExtension(fileExtension)) {
					// 403 Unauthorized
					server.quickr(res, 403, 'File extension is not allowed by server');
					server.echo('# File extension is not allowed by server : '.error + fileExtension);
				} else {

					var resourcePath = conf.publicDir + pathname;

					if(fileExtension == 'less') 
					{
						var cachefile = path.join(conf._cacheDir,  pathname + '.js');
						if(fs.existsSync(cachefile)) {
							resourcePath = cachefile;
							fileExtension = 'js';
						}
					}

					// Load resource
				    fs.readFile(resourcePath, function(err, data) { 
				        if (err) { 
				            // 404 (FILE_NOT_FOUND)
				            server.quickr(res, 404, 'FILE_NOT_FOUND');
				            server.echo('# Resource ' + 'not found : '.error + resourcePath);
				        } else {
				        	// 200 (OK)

							if(fileExtension == 'less') {

								lessParser.parse(data.toString(), function (err, tree) {
								    if (err) { 
							            // 500 (INTERNAL SERVER ERROR)
							            server.quickr(res, 500, 'LESS_PARSE_ERROR');
							            server.echo('# Less parse error : ', err.message.error);
								    } else {
								    	var mimeType = mime.lookup('less.css');
								    	var css = tree.toCSS({ compress: true });
								    	server.quickr(res, 200, css, mimeType);
								    	fs.mkdir(path.join(conf._cacheDir, path.dirname(pathname)), function() {
									    	fs.writeFile(path.join(conf._cacheDir, pathname + '.js'), css, function(err) {
									    		if(err) {
									    			server.echo('# Unable to cache file : ', resourcePath, err.message.red);
									    		} else {
									    			server.echo('# Update cache file : ', resourcePath);
									    		}
									    	});	
								    	});
								    	
								    }
								});

							} else if(fileExtension == 'coffee') {
								try {
									var js = coffee.compile(data.toString());
									var mimeType = mime.lookup('coffee.js');
									server.quickr(res, 200, js, mimeType);
								} catch(exception) {
						            // 500 (INTERNAL SERVER ERROR)
						            server.quickr(res, 500, 'COFFEESCRIPT_COMPILE_ERROR');
						            server.echo('# Coffee script compile error : ', exception.message.error);
								}
								
							} else {

					        	var mimeType = mime.lookup(pathname);
					        	server.quickr(res, 200, data, mimeType);
					        	if(!mimeType) {
					        		server.echo('# No mime type found' .error + ' : file ' + pathname);
					        	}
				        	}
				        } 
				    });

				}
			}
		});

	}).on('error', function(err) {
		server.echo('# Unable to run server '.red + 'at http://' + conf.server.host + ':' +  conf.server.port.toString().magenta + '/' , err.message);
	}).on('listening', function() {
		server.echo('# Server running at http://' + (conf.server.host || '') + ':' +  conf.server.port.toString().magenta + '/');	
	}).listen(conf.server.port, conf.server.host);

};

// Load properties

var config = {
    comment: "#",
    separator: "=",
    sections: true
};

properties.load("./server.properties", config, function (error, p) {
	if(error) {
		server.echo('# Unable to load server properties > '.error, error.message);
	} else {
		server.echo('# Server properties ' + 'loaded'.info);

		// Make sure publicDir is defined
		if(!p.publicDir) {
			p.publicDir = p.baseDir + 'public/';
		}

		p._cacheDir = path.join(p.baseDir , 'cache');

		fs.mkdir(p.baseDir + 'cache', function(err) {
			if(err && err.code != 'EEXIST') {
				server.echo('# Unable to create cache directory :', err.message.red);
			}
		});

		server.config = _serverConfiguration = p;

		// Set logger
		server.logger = new (winston.Logger)({
		    transports: [
		      new (winston.transports.File)({ filename: server.config.log.file || 'server.log', json:false, colorize: false })
		    ]
		});
		server.logger.cli();
		server.logger.extend(server);

		properties.load(p.baseDir + "config.properties", config, function (error, p) {
			if(error) {
				if(error.code != 'ENOENT') {
					server.echo('# Unable to load application properties > '.error, error.message);
				} else {
					application.config = {};
					run(server.config);
				}
			} else {
				server.echo('# Application properties ' + 'loaded'.info);
				application.config = p;
				run(server.config);
			}
		});
	}
});