// Core libs
var coffee 			= require('coffee-script');
var events			= require('events');

server;
fs;
path;

var helper = function() {

	var isValidResource = function(resourcePath) {
		return path.extname(resourcePath).toUpperCase() == '.COFFEE';
	};

	var getCachefilename = function(resourcePath) {
		return 'coffee/' + path.basename(resourcePath) + '.js';
	};

	var isCatchable = function(eventName) {
		if(eventName == 'resource' && isValidResource(arguments[1])) {
			return true;
		}
		return false;
	};

	var doResource = function(resourcePath, data, fn) {

		if(!isValidResource(resourcePath)) {
			fn(new Error('INVALID COFFEESCRIPT RESOURCE'));
			return false;
		}

		var cacheFileName = getCachefilename(resourcePath);

		if(!server.fromCache(cacheFileName, function(err, data) {
			if(err) {
				server.echo('# Unable to load resource from cache'.error, cacheFileName);
				fn(err);
			} else {
				fn(null, data, 'text/css');
			}
		})) {
			parse(resourcePath, data, fn);
		}

		watchFile(resourcePath);

		return true;

	};

	var parse = function(resourcePath, data, fn) {

		fn = fn || function() {};

		if(!data) {
			fs.readFile(resourcePath, function(err, data) {
				if(err) {
					server.echo(err.message.error);
				} else {
					parse(resourcePath, data, fn);
				}
			});
			return;
		}

		try {
			var js = coffee.compile(data.toString());
			fn(null, js, 'text/js');

			var cacheFileName = getCachefilename(resourcePath);
	    	server.toCache(cacheFileName, js, function(err) {
	    		if(err) {
	    			server.echo('# Unable to cache file : ', resourcePath, err.message.red);
	    		} else {
	    			server.echo('# Update cache file : '.info, resourcePath);
	    		}
	    	});

		} catch(err) {
			server.echo('# Less parse error : ', err.message.error);
			fn(err);
		}

	};

	var watchFile = function(filepath) {
		server.resources.watch(filepath, function(filename) {
			console.log('parse', filename.info);
			parse(filename);
		});
	};

	var constructor = function() {
		this.doResource = doResource;
		this.isCatchable = isCatchable;
	};

	util.inherits(constructor, events.EventEmitter);

	var coffeeHelper = new constructor();
	coffeeHelper.on('resource', function(resourcePath, data, fn) {
		console.log('onResource', resourcePath, data, fn);
		this.doResource(resourcePath, data, fn);
	});

	return coffeeHelper;

}();

server.helpers.register('coffee', helper);

exports = helper;