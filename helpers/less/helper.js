// Core libs
var less 			= require('less');
var path 			= require('path');
var fs 				= require('fs');

server;

var helper = function() {

	var isValidResource = function(resourcePath) {
		return path.extname(resourcePath).toUpperCase() == '.LESS';
	};

	var doResource = function(resourcePath, data, fn) {

		if(!isValidResource(resourcePath)) {
			return false;
		}

		var cacheFileName = 'less/' + path.basename(resourcePath) + '.css';

		if(!server.fromCache(cacheFileName, function(err, data) {
			if(err) {
				server.echo('# Unable to load resource from cache'.error, cacheFileName);
			} else {
				fn(null, data, 'text/css');
			}
		})) {

			var parser = new(less.Parser)({
				paths: [path.dirname(resourcePath)],
				filename: resourcePath
			});

			parser.parse(data.toString(), function (err, tree) {
			    if (err) { 
			        // 500 (INTERNAL SERVER ERROR)
			        server.echo('# Less parse error : ', err.message.error);
			        fn(err);
			    } else {
			    	var css = tree.toCSS({ compress: true });
			    	
			    	fn(null, css, 'text/css');
			    	console.log(cacheFileName);
			    	server.toCache(cacheFileName, css, function(err) {
			    		if(err) {
			    			server.echo('# Unable to cache file : ', resourcePath, err.message.red);
			    		} else {
			    			server.echo('# Update cache file : '.info, resourcePath);
			    		}
			    	});
			    	
			    }
			});
		}

		return true;

	};

	var watchDir = function(dir) {
		fs.readdir(dir, function(err, files) {
			if(err) {
				server.echo('#', err.message.error);
			} else {
				files.forEach(function(filename) {
					var filepath = path.join(dir, filename);
					if(!path.extname(filepath)) {
						watchDir(filepath);
					} else {
						if(isValidResource(filename) && path.basename(filename).substr(0, 1) != '_') {
							console.log('watch', filepath);
							fs.watch(filepath, function(event, filename) {
								console.log('event is: ' + event, filename);
							});
						}
					}
				});
			}
		});
	};

	var dovhost = function(vhost) {
		console.log(vhost.ini.publicDir);
		watchDir(vhost.ini.publicDir);
	};

	return {
		doResource: doResource,
		dovhost: dovhost
	};

}();

server.helpers['less'] = helper;
exports = helper;

