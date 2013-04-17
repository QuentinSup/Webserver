
server;

var _controllers = {};

var register = function(name, obj) {
	_controllers[name] = obj;
};

var get = function(name) {
	return _controllers[name];
};

var run = function(params, response, request) {
	_controllers[params.controller].run(response, request, params);
};

server.controllers = exports = {
	register: register,
	get: get,
	run: run,
	getAll: function() {
		return _controllers;
	}
};