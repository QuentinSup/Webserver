
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
//https://github.com/ashtuchkin/iconv-lite
var iconv 			= require('iconv-lite');
//https://github.com/andris9/Nodemailer
var mailer			= require('nodemailer');

colors.setTheme({
	info 	: 'green',
	data 	: 'white',
	help 	: 'cyan',
	warn 	: 'yellow',
	debug 	: 'blue',
	error 	: 'red'
});

var config_properties = {
    comment: "#",
    separator: "=",
    sections: true
};

serverConfiguration = {};
server = {}
server.config = {};

// Import base modules
require('./modules/_controllers');
require('./modules/_routes');

server.application = application = {};
server.vhosts = vhosts = {};

server.quickr = function(response, statusCode, data, mimeType) {
	try {
		mimeType = mimeType || 'text/plain';
		response.writeHead(statusCode, {'Content-Type': mimeType });
		response.end(data, 'utf8');
	} catch(exception) {
		server.echo('# Unable to return response > '.error, exception);	
		// 500 Internal Server Error
		response.writeHead(500);
		response.end(data, 'utf8');
	}
};

server.quickrJSON = function(response, statusCode, data) {
	server.quickr(response, statusCode, JSON.stringify(data), 'application/json');
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

server.encode = function(str, encoding) {
	return iconv.encode(str, encoding);
};

server.decode = function(buf, encoding) {
	return iconv.decode(buf, encoding);
};

server.applyConfiguration = function(conf) {

	conf._cacheDir = './cache';

	fs.mkdir(conf._cacheDir, function(err) {
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

server.require = function(name) {
	return require(name);
};

server.plugins = function(name) {
	return require('./' + path.join('plugins', name, name + '.js'));
};

server.writeFileToCache = function(fileName, data, fn) {
	var cachefile = path.join(server.config._cacheDir, fileName);
	fs.writeFile(cachefile, data, fn);
};

server.getFileFromCache = function(fileName, fn) {
	var cachefile = path.join(server.config._cacheDir, fileName);
	fs.readFile(cachefile, fn);
};

server.runController = function(params, response, request, conf) {
	// Call a controller
	conf = conf || server.config;
	if(!server.controllers.exists(params.controller))
	{
		try {
			require(path.join(conf.baseDir, 'controllers', params.controller + '.js'));
			server.echo('# Controller', params.controller.info, 'loaded');
		} catch(exception) {
			try {
				server.plugins(params.controller);
				server.echo('# Controller [server]', params.controller.info, 'loaded');
			} catch(exception) {
				// 500 Internal Server Error
				server.quickr(response, 500);
				server.echo('# Unable to load controller : '.error, params.controller.info);
				server.echo(exception.message.error);
			}
		}
	} 
	try {
		server.controllers.run(params, response, request);
	} catch(exception) {
		// 500 Internal Server Error
		server.quickr(response, 500);
		server.echo('# Unable to run controller : '.error, params.controller.info);
		server.echo(exception.message.info);
	}
};

var preloadControllers = function(baseDir) {
	server.echo('# Preload controllers'.info);
	var controllersDirectory = baseDir?path.join(baseDir, 'controllers/'):'./controllers/';
	fs.readdir(controllersDirectory, function(err, list) {
		if(!err) {
			list.forEach(function(file) {
				if(path.extname(file) == '.js') {
					require(controllersDirectory + file);
					server.echo('# Controller', file.info, 'preloaded');
				};
			});
		} else {
			server.echo(err.message.error);
		}
	});
};

var loadVirtualHosts = function(conf) {
	server.echo('# Load vhosts'.info);
	var confDir = './conf/vhosts/';
	fs.readdir(confDir, function(err, list) {
		if(!err) {
			list.forEach(function(file) {
				if(path.extname(file) == '.properties') {
					properties.load(path.join(confDir, file), config_properties, function (error, p) {
						if(error) {
							console.log(error.message.error);
						}
						var vhostId = path.basename(file, '.properties');
						var vhost = server.vhosts[vhostId] = {};
						vhost.ini = p || {};
						vhost.id  = vhostId;
						if(!vhost.ini.publicDir) {
							vhost.ini.publicDir = path.join(vhost.ini.baseDir, 'public');
						}
						loadVHostConf(vhost);
						server.echo('# Virtual Hosts', file.info, 'loaded');
					});
				};
			});
			run(conf);
		} else {
			server.echo(err.message.warn);
			preloadControllers();
			run(conf);
		}
	});
};

var loadVHostConf = function(vhost) {
	properties.load(path.join(vhost.ini.baseDir, "config.properties"), config_properties, function (error, p) {
		if(error) {
			if(error.code != 'ENOENT') {
				server.echo('# Unable to load application properties > '.error, error.message);
			} else {
				vhost.config = application.config = {};
			}
		} else {
			server.echo('# Application properties ', 'loaded'.info);
			vhost.config = application.config = p;
			// Preload controllers
			preloadControllers(vhost.baseDir);
		}
	});
};

var sendMail = function(options, fn) {
	if(server.emailer.transport) {
		fn = fn || function() {};
		options.from = options.from || (server.config.emailer.from || 'Node http server');
		server.emailer.transport.sendMail(options, function(err, response) {
			if(err) {
				server.echo(err.message.error);
			}
			fn(err, response);
		});
	} else {
		server.echo('# No transport configured'.error);
	}
};

server.emailer = {
	send: sendMail
};

// Run server
var run = function(conf) {

	// Prepare emailer
	if(conf.emailer && conf.emailer.service) {
		server.emailer.transport = mailer.createTransport("SMTP", {
		    service: conf.emailer.service,
		    auth: {
		        user: conf.emailer.user,
		        pass: new Buffer(conf.emailer.pass, 'base64').toString()
		    }
		});
	}

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
        	
            var vhostName = pathname.substr(1, pathname.substr(1).indexOf('/'));
            var vhost 	  = server.vhosts[vhostName];
            var resourcePath = '';
            var resourceFilePath = null; 
			if(vhost) {

	            resourceFilePath = pathname.substr(vhostName.length + 1);
			    if(resourceFilePath == '/') {
			    	resourceFilePath = '/' + conf.root;
			   	}

				resourcePath = path.join(vhost.ini.publicDir, resourceFilePath);


			} else {
				resourceFilePath = req.path.pathname;
				resourcePath = '.' + resourceFilePath;
			}

			if(resourceFilePath) {

		    	// Load resource
				if(resourceFilePath.lastIndexOf('.') == -1) {

					var params = server.routes.getRoutePathParameters(resourceFilePath);

					if(params != null && params.controller) {
						server.runController(params, res, req, conf);
					} else {
			            // 404 (FILE_NOT_FOUND)
			            server.quickr(res, 404, 'FILE_NOT_FOUND');
			            server.echo('# Controller', 'missing '.error, resourcePath);
					}

				} else {
					var fileExtension 	= path.extname(resourceFilePath).toLowerCase().substr(1);
					if(!server.isAuthorizedExtension(fileExtension)) {
						// 403 Unauthorized
						server.quickr(res, 403, 'File extension is not allowed by server');
						server.echo('# File extension is not allowed by server : '.error + fileExtension);
					} else {

						// Load resource
					    fs.readFile(resourcePath, function(err, data) { 
					        if (err) { 
					            // 404 (FILE_NOT_FOUND)
					            server.quickr(res, 404, 'FILE_NOT_FOUND');
					            server.echo('# Resource ', 'not found : '.error, resourcePath.data);
					        } else {
					        	// 200 (OK)
					        	var mimeType = mime.lookup(resourcePath);
					        	server.quickr(res, 200, data, mimeType);
					        	if(!mimeType) {
					        		server.echo('# No mime type found' .error + ' : file ' + pathname);
					        	}
					        } 
					    });

					}
				}
			}
		});

	}).on('error', function(err) {
		server.echo('# Unable to run server'.error, 'at http://' + conf.server.host + ':', conf.server.port.toString().magenta, '/' , err.message);
		throw err;
	}).on('listening', function() {
		server.echo('# Server running at', 'http://'.magenta + '127.0.0.1'.magenta + ':' + conf.server.port.toString().data);
		server.echo('# Autorized remote mask :'.grey, (conf.server.host || '').data);	
	}).listen(conf.server.port, conf.server.host);

};

// Load properties
properties.load("./conf/server.properties", config_properties, function (error, p) {
	if(error) {
		server.echo('# Unable to load server properties > '.error, error.message);
	} else {
		server.echo('# Server properties ' + 'loaded'.info);
		server.applyConfiguration(p);

		loadVirtualHosts(p);

	}
});

exports = server;