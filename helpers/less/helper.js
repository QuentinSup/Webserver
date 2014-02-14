// Core libs
var less 			= require('less');
var events			= require('events');

server;
fs;
path;

var helper = function() {

	var isValidResource = function(resourcePath) {
		return path.extname(resourcePath).toUpperCase() == '.LESS';
	};

	var getCachefilename = function(resourcePath) {
		return 'less/' + path.basename(resourcePath) + '.css';
	};

	var isCatchable = function(eventName) {
		if(eventName == 'resource' && isValidResource(arguments[1])) {
			return true;
		}
		return false;
	};

	var doResource = function(resourcePath, data, fn) {

		if(!isValidResource(resourcePath)) {
			fn(new Error('INVALID LESS RESOURCE'));
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

		var parser = new(less.Parser)({
			paths: [path.dirname(resourcePath)],
			filename: resourcePath
		});

		parser.parse(data.toString(), function (err, tree) {
		    if (err) { 
		        server.echo('# Less parse error : ', err.message.error);
		        fn(err);
		    } else {
		    	var css = tree.toCSS({ compress: true });
		    	
		    	fn(null, css, 'text/css');

		    	var cacheFileName = getCachefilename(resourcePath);
		    	server.toCache(cacheFileName, css, function(err) {
		    		if(err) {
		    			server.echo('# Unable to cache file : ', resourcePath, err.message.red);
		    		} else {
		    			server.echo('# Update cache file : '.info, resourcePath);
		    		}
		    	});
		    	
		    }
		});
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

	var lessHelper = new constructor();
	lessHelper.on('resource', function(resourcePath, data, fn) {
		this.doResource(resourcePath, data, fn);
	});

	return lessHelper;

}();

server.helpers.register('less', helper);

exports = helper;