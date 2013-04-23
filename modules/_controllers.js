
server;

var _controllers = {};

var register = function(name, obj) {
	_controllers[name] = obj;
};

var get = function(name) {
	return _controllers[name];
};

var exists = function(name) {
	return get(name) != undefined;
};


var run = function(params, response, request) {
	_controllers[params.controller].run(response, request, params);
};

server.controllers = exports = {
	register: register,
	get: get,
	exists: exists,
	run: run,
	getAll: function() {
		return _controllers;
	}
};