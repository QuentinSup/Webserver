
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
				this.requirevhost(this.ini.baseDir?path.join(this.ini.baseDir, 'controllers', params.controller + '.js'):'./controllers/' + params.controller + '.js');
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
			server.echo(exception.message.error);
		}
	};

	var requirevhost = function(file) {
		try {
			var newModule = new Module(file, module);
			var controller = newModule.loadInContext({ 
				server: server,
				application: this.application,
				__basedir: this.ini.baseDir })
			var basename = path.basename(file);
			this.controllers.register(basename.substr(0, basename.length - path.extname(file).length), controller);
			server.echo('PRELOAD'.debug, 'CONTROLLER'.info, 'OK'.success, file);
		} catch(err) {
			server.echo('PRELOAD'.debug, 'CONTROLLER'.info, 'ERR'.error, file, err.message.error);
		}

	};

	var loadControllers = function() {
		var controllersDirectory = this.ini.baseDir?path.join(this.ini.baseDir, 'controllers/'):'./controllers/';
		var self = this;
		fs.readdir(controllersDirectory, function(err, list) {
			if(!err) {
				list.forEach(function(file) {
					if(path.extname(file) == '.js') {
						self.requirevhost(controllersDirectory + file);
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
		this.requirevhost = requirevhost;
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

var Module 			= require('module');
Module.prototype.loadInContext = function(global) {
	var self			= this;
	var filename 		= Module._resolveFilename(this.id, this);
	var dirname 		= path.dirname(filename);

	Module._cache[filename] = this;
	this.filename 	= filename;
	this.paths 		= Module._nodeModulePaths(dirname);

	var content = fs.readFileSync(filename, 'utf-8');
		//stripBOM
	if (content.charCodeAt(0) === 0xFEFF) {
		content = content.slice(1);
	}

	content = content.replace(/^\#\!.*/, '');

	function require(path) {
	    return self.require(path);
	}

	require.resolve = function(request) {
		return Module._resolveFilename(request, self);
	};

	Object.defineProperty(require, 'paths', { get: function() {
		throw new Error('require.paths is removed. Use ' +
	                'node_modules folders, or the NODE_PATH ' +
	                'environment variable instead.');
	}});

	require.main = process.mainModule;

	// Enable support to add extra extension types
	require.extensions = Module._extensions;
	require.registerExtension = function() {
		throw new Error('require.registerExtension() removed. Use ' +
	                'require.extensions instead.');
	};

	require.cache = Module._cache;

	var extend = require('util')._extend;
	var sandbox = extend(global, {
		exports: {},
		module: this,
		require: require,
		setTimeout: setTimeout,
		setInterval: setInterval,
		clearInterval: clearInterval,
		Buffer: Buffer,
		console: console,
		__filename: filename,
		__dirname: dirname
	});

	this.sandbox = sandbox;

	sandbox.global = sandbox;

	var context = vm.createContext(sandbox);
	var code = vm.createScript(content);
	this.exports = code.runInContext(context);

	this.loaded = true;	

	return this.exports;
};

exports = server.vhosts = vhosts;