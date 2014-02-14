
var vm = require('vm');

server;

var Controllers = function() {

	var register = function(name, controller) {
		this._controllers[name] = controller;
	};

	var get = function(name) {
		return this._controllers[name];
	};

	var getAll = function() {
		return this._controllers;
	};

	var exists = function(name) {
		return this.get(name) != undefined;
	};

	var run = function(params, response, request) {
		this._controllers[params.controller].run(response, request, params);
	};

	var constructor = function() {

		this.register = register;
		this.get = get;
		this.getAll = getAll;
		this.exists = exists;
		this.run = run;
		this._controllers = {};

	};

	return constructor;

}();

var Controller = function() {

	
	var constructor = function(fn) {
		this.run = fn;
	};

	return constructor;

}();

var VirtualHost = function() {

	var run = function(params, response, request) {
		// Call a controller
		if(!this.controllers.exists(params.controller))
		{
			try {
				require(this.ini.baseDir?path.join(this.ini.baseDir, 'controllers', params.controller + '.js'):'./controllers/' + params.controller + '.js');
				server.echo('# Controller', params.controller.info, 'loaded');
			} catch(exception) {
				//try {
				//	server.plugins(params.controller);
				//	server.echo('# Controller [server]', params.controller.info, 'loaded');
				//} catch(exception) {
					// 500 Internal Server Error
					server.quickr(response, 500);
					server.echo('# Unable to load controller : '.error, params.controller.info);
					server.echo(exception.message.error);
					return;
				//}
			}
		}
		try {
			this.controllers.run(params, response, request);
		} catch(exception) {
			// 500 Internal Server Error
			server.quickr(response, 500);
			server.echo('# Unable to run controller : '.error, params.controller.info);
			server.echo(exception.message.info);
		}
	};

	var loadControllers = function() {
		var controllersDirectory = this.ini.baseDir?path.join(this.ini.baseDir, 'controllers/'):'./controllers/';
		var self = this;
		fs.readdir(controllersDirectory, function(err, list) {
			if(!err) {
				list.forEach(function(file) {
					if(path.extname(file) == '.js') {
						try {
							var sandbox = {
								exports: {},
								require: require,
								__MODULE: controllersDirectory + file,
								application: self.application
							};
							var context = vm.createContext(sandbox);
							var code = vm.createScript('require(__MODULE);');
							code.runInContext(context);
							var controller = sandbox.exports;
							self.controllers.register(controller);
							server.echo('PRELOAD'.debug, 'CONTROLLER'.info, 'OK'.success, file);
							
						} catch(exception) {
							server.echo('PRELOAD'.debug, 'CONTROLLER'.info, 'ERR'.error, file, exception.message.error);
						}
					};
				});
			} else {
				server.echo(err.message.error);
			}
		});
	};

	var loadConf = function(vhost) {
		properties.load(path.join(vhost.ini.baseDir, "config.properties"), config_properties, function (error, p) {
			if(error) {
				if(error.code != 'ENOENT') {
					server.echo('LOAD'.debug, 'VHOST'.info, 'ERR'.error, vhost.id.magenta, 'Unable to load application properties > ', error.message.error);
				} else {
					server.echo('LOAD'.debug, 'VHOST'.info, 'WARN'.warn, vhost.id, 'target', vhost.ini.publicDir.debug);
					vhost.application = {};
					loadControllers.call(vhost);
				}
			} else {
				server.echo('LOAD'.debug, 'VHOST'.info, 'OK'.success, vhost.id, 'target', vhost.ini.publicDir.debug);
				vhost.application = p;
				// Preload controllers
				loadControllers.call(vhost);
			}
		});
	};

	var constructor = function(id, conf) {

		this.id = id;
		this.ini = conf;
		this.run = run;
		this.controllers = new Controllers();

		if(!this.ini.publicDir) {
			this.ini.publicDir = path.join(this.ini.baseDir, 'public');
		}

		loadConf(this);

	};

	return constructor;

}();

var vhosts = function() {

	var _vhosts = {};

	var get = function(vhostid) {
		return _vhosts[vhostid];
	};

	var prepare = function(fn) {
		var confDir = './conf/vhosts/';
		fs.readdir(confDir, function(err, list) {
			if(!err) {
				list.forEach(function(file) {
					if(path.extname(file) == '.properties') {
						properties.load(path.join(confDir, file), config_properties, function (error, p) {
							if(error) {
								server.echo(error.message.error);
							}
							var vhostId = path.basename(file, '.properties');
							register(create(vhostId, p));

						});
					};
				});
				fn(null);
			} else {
				fn(err);
			}
		});
	};

	var register = function(vhost) {
		_vhosts[vhost.id] = vhost;
	};

	var create = function(vhostId, conf) {
		return new VirtualHost(vhostId, conf);
	};

	return {
		prepare: prepare,
		create: create,
		get: get,
		register: register,
		Controller: Controller
	};

}();

exports = server.vhosts = vhosts;