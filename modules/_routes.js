
server;

var _routes = [];

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

var getRoutePathParameters = function(pathname) {
	var params = {};
	for(var i = 0, len = _routes.length; i < len; i++) {
		var isMatched = _routes[i].match(pathname, params);
		if(isMatched) {
			return params;
		}
	}
	return null;
};

// Routes
_routes.push(hashRoutePath('/:controller/', false, false));
_routes.push(hashRoutePath('/:controller/:action/:id', false, false));

exports = server.routes = {
	getRoutePathParameters: getRoutePathParameters,
	items: _routes,
	add: _routes.push
};