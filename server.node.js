
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

serverConfiguration = {};
server = {}
server.config = {};

// Import modules
require('./modules/_controllers');
require('./modules/_routes');

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


server.applyConfiguration = function(conf) {

	// Make sure publicDir is defined
	if(!conf.publicDir) {
		conf.publicDir = conf.baseDir + 'public/';
	}

	conf._cacheDir = path.join(conf.baseDir , 'cache');

	fs.mkdir(conf.baseDir + 'cache', function(err) {
		if(err && err.code != 'EEXIST') {
			server.echo('# Unable to create cache directory :', err.message.red);
		}
	});

	// Set logger
	server.logger = new (winston.Logger)({
	    transports: [
	      new (winston.transports.File)({ filename: conf.log.file || 'server.log', json:false, maxsize:10248576, colorize: false })
	    ]
	});
	server.logger.cli();
	server.logger.extend(server);

	return 	server.config = serverConfiguration = conf;

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

				var params = server.routes.getRoutePathParameters(pathname);

				if(params != null && params.controller) {
					// Call a controller
					try {
						require(path.join(conf.baseDir, 'controllers', params.controller + '.js'));
						server.controllers.run(params, res, req);
					} catch(exception) {
						// 500 Internal Server Error
						server.quickr(res, 500);
						server.echo('# Unable to run controller : '.error, controllerName);
						server.echo(exception);
					}
				} else {
		            // 404 (FILE_NOT_FOUND)
		            server.quickr(res, 404, 'FILE_NOT_FOUND');
		            server.echo('# Controller ', 'not found '.error, conf.baseDir + pathname);
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
				            server.echo('# Resource ', 'not found : '.error, resourcePath);
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
		server.echo('# Unable to run server '.error, 'at http://' + conf.server.host + ':', conf.server.port.toString().magenta, '/' , err.message);
	}).on('listening', function() {
		server.echo('# Server running at http://' + (conf.server.host || '') + ':' +  conf.server.port.toString().magenta + '/');	
	}).listen(conf.server.port, conf.server.host);

};

// Load properties

var config_properties = {
    comment: "#",
    separator: "=",
    sections: true
};

properties.load("./server.properties", config_properties, function (error, p) {
	if(error) {
		server.echo('# Unable to load server properties > '.error, error.message);
	} else {
		server.echo('# Server properties ' + 'loaded'.info);
		server.applyConfiguration(p);

		properties.load(p.baseDir + "config.properties", config_properties, function (error, p) {
			if(error) {
				if(error.code != 'ENOENT') {
					server.echo('# Unable to load application properties > '.error, error.message);
				} else {
					application.config = {};
					run(server.config);
				}
			} else {
				server.echo('# Application properties ', 'loaded'.info);
				application.config = p;
				run(server.config);
			}
		});
	}
});

exports = server;