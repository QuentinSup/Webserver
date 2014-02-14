
// Core libs
var http 			= require('http');
var url  			= require('url');
var qs  			= require('querystring');

util  			= require('util');
path  			= require('path');
fs  			= require('node-fs');

//https://github.com/Gagle/Node-Properties
properties  	= require('properties');
// Other libs
//https://github.com/marak/colors.js/
var colors  	    = require('colors');
//https://github.com/broofa/node-mime
var mime			= require('mime');
//https://github.com/flatiron/winston
var winston			= require('winston');
//https://github.com/ashtuchkin/iconv-lite
var iconv 			= require('iconv-lite');
//https://github.com/andris9/Nodemailer
var mailer			= require('nodemailer');

colors.setTheme({
	info 		: 'cyan',
	success 	: 'green',
	data 		: 'white',
	help 		: 'cyan',
	warn 		: 'yellow',
	debug 		: 'grey',
	error 		: 'red'
});

config_properties = {
    comment: "#",
    separator: "=",
    sections: true
};

serverConfiguration = {};
server = {}
server.config = {};

// Import base modules
require('./modules/_routes');
require('./modules/_resources');
require('./modules/_helpers');
require('./modules/_vhosts');

server.argv = {
	verbose: process.argv.indexOf('--verbose') > -1
};

server.quickr = function(response, statusCode, data, mimeType, encoding) {
	encoding = encoding || 'utf8';
	try {
		mimeType = mimeType || 'text/plain';
		response.writeHead(statusCode, {'Content-Type': mimeType });
		response.end(data, encoding);
	} catch(exception) {
		server.echo('# Unable to return response > '.error, exception);	
		// 500 Internal Server Error
		response.writeHead(500);
		response.end(data, encoding);
	}
};

server.quickrJSON = function(response, statusCode, data, encoding) {
	server.quickr(response, statusCode, JSON.stringify(data), 'application/json', encoding);
};

// Make server.echo an alias of console.log
server.echo = function() {
	var args = arguments;
	
	var self = this;
	setTimeout(function() {
		console.log.apply(self, args);
		if(self.info) {
			var arguments = [];
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
			server.echo('# Unable to create cache directory :', err.message.error);
		}
	});

	// Set logger
	server.logger = new (winston.Logger)({
	    transports: [
	      new (winston.transports.File)({ level: conf.log.level || 'info', filename: conf.log.file || 'server.log', json:false, maxsize:10248576, colorize: false })
	    ]
	});

	//server.logger.cli();
	server.logger.extend(server);

	return server.config = serverConfiguration = conf;

};

server.require = function(name) {
	return require(name);
};

server.plugins = function(name) {
	return require('./' + path.join('plugins', name, name + '.js'));
};

server.toCache = function(fileName, data, fn) {
	var dirname = path.join(server.config._cacheDir, path.dirname(fileName));
	var cachefile = path.join(dirname, path.basename(fileName));
	fs.mkdir(dirname, null, true, function(err) {
		if(err) {
			server.echo('> Unable to create cache directory'.error, dirname);
			fn(err);
		} else {
			fs.writeFile(cachefile, data, fn);
		}
	});
};

server.fromCache = function(fileName, fn) {
	var cachefile = path.join(server.config._cacheDir, fileName);
	if(fs.existsSync(cachefile)) {
		fs.readFile(cachefile, fn);
		return true;
	}
	return false;
};

var loadHelpers = function(fn) {
	var helpersDir = './helpers/';
	fs.readdir(helpersDir, function(err, list) {
		if(!err) {
			list.forEach(function(file) {
				var helperFileName = './' + path.join(helpersDir, file) + '/helper.js';
				if(fs.existsSync(helperFileName)) {
					try {
						require(helperFileName);
						server.echo('LOAD'.debug, 'HELPER'.info, 'OK'.success, file);
					} catch(err) {
						server.echo('LOAD'.debug, 'HELPER'.info, 'ERR'.success, file);
					}
				} else {
					server.echo('LOAD'.debug, 'HELPER'.info, 'WARN'.warn, file);
				}
			});
			fn(null);
		} else {
			fn(err);
			
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

		if(server.argv.verbose) {
			server.echo('HTTP', req.httpVersion.info, req.method.debug, req.url, req.headers['user-agent'].info);
		}

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
            var vhost 	  = server.vhosts.get(vhostName);
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
				var extname = path.extname(resourceFilePath);
				
		    	// Load resource
				if(!extname) {

					var params = server.routes.getRoutePathParameters(resourceFilePath);
					
					if(params != null && params.controller) {
						vhost.run(params, res, req);
					} else {
			            // 404 (FILE_NOT_FOUND)
			            server.quickr(res, 404, 'FILE_NOT_FOUND');
			            server.echo('# Controller', 'missing '.error, resourcePath);
					}

				} else {
					var fileExtension 	= path.extname(resourceFilePath).toLowerCase().substr(1);
					if(!server.isAuthorizedExtension(fileExtension)) {
						// 403 Unauthorized
						server.quickr(res, 403, 'RESOURCE_DENIED_BY_POLICY');
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
					        	if(!server.helpers.emit('resource', resourcePath, data, function(err, data, mimeType) {
					        		if(err) {
					        			server.quickr(res, 500, 'INTERNAL_SERVER_ERROR');
					        		} else {
					        			server.quickr(res, 200, data, mimeType);	
					        		}					        		
					        	})) {
						        	var mimeType = mime.lookup(resourcePath);
						        	server.quickr(res, 200, data, mimeType);
						        	if(!mimeType) {
						        		server.echo('# No mime type found' .error + ' : file ' + pathname);
						        	}
					        	}
					        } 
					    });
						
					}
				}
			}

		});

	}).on('error', function(err) {
		server.echo('RUN'.debug, 'SERVER'.info, 'ERR'.error, '# Unable to run server'.error, 'at http://' + conf.server.host + ':', conf.server.port.toString().info, '/' , err.message);
		throw err;
	}).on('listening', function() {
		server.echo('RUN'.debug, 'SERVER'.info, 'OK'.success, 'Server running at', 'http://'.magenta + '127.0.0.1'.magenta + ':' + conf.server.port.toString().data, '# Autorized remote mask :'.grey, (conf.server.host || '').data);
	}).listen(conf.server.port, conf.server.host);

};

// Load properties
properties.load("./conf/server.properties", config_properties, function (error, conf) {
	if(error) {
		server.echo('LOAD'.debug, 'CONF'.info, 'ERR'.error, 'Server properties'.error, error.message);
	} else {
		server.echo('LOAD'.debug, 'CONF'.info, 'OK'.success, 'Server properties');
		server.applyConfiguration(conf);

		loadHelpers(function(err) {
			if(err) {
				server.echo(err.message.warn);
			}
			server.vhosts.prepare(function(err) {
				if(err) {
					server.echo(err.message.warn);
				}
				run(conf);
			});
		});

	}
});

exports = server;