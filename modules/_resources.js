
server;
fs;

var resources = function() {

	var _resourcesWatched = {};

	var getWatchProcess = function(path) {
		return _resourcesWatched[path];
	};

	var watch = function(path, fn) {
		if(!getWatchProcess(path)) {
			console.log('watchFile', path);
			var watcher = fs.watchFile(path, { persistent: false }, function(curr, prev) {
				console.log(path, 'changed'.info);
				fn(path, curr, prev);
			});
			_resourcesWatched[path] = watcher;
		}
	};

	var unwatch = function(path) {
		var watcher = getWatchProcess(path);
		if(watcher) {
			fs.unwatchFile(path);
			delete _resourcesWatched[path];
			return true;
		}
		return false;
	};

	return {
		watch: watch,
		unwatch: unwatch,
		getWatchProcess: getWatchProcess
	};

}();


exports = server.resources = resources;