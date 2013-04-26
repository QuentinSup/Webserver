var http			= require('http');

//https://github.com/dscape/nano
var nano		 	= require('nano');

server;
application;

var couchdb = (function() {

	var _conn;
	var _db;

	var use = function(dbname) {
		_db = _conn.use(dbname);
	};

	var connect = function(host, port, protocol) {
		return _conn = nano((protocol || 'http') + '://' + host + ':' + port);
	};

	var get = function(id, fn) {
 		_db.get(id, fn);
	};

	var getAll = function(fn, opts) {
		opts = opts || {};
		opts.revs_info = true;
		opts.include_docs = true;
 		_db.list(opts, fn);
	};

	var insert = function(id, doc, fn) {
		_db.insert(doc, id,  function(err, xdoc) {
			if(!err) {
		    	doc._id = xdoc.id;
		    	doc._rev = xdoc.rev;
			}
			if(fn) {
				fn(err, doc);
			}
		})
	};

	var destroy = function(id, rev, fn) {
		_db.destroy(id, rev, fn);
	};

	var run = function(response, request, params) {
		
		if(request.method == 'GET') {

			var pid 	= request.path.query.id;

			if(pid) {

				if(pid == '*') {
			 		getAll(function(err, docs) {
				        if(!err) {
					    	server.quickrJSON(response, 200, docs.rows);
						} else {
							server.echo('> COUCHDB documents not found'.red, err.message);
							server.quickr(response, 404);
						}
				    });
				} else {
			 		get(pid, function(err, doc) {
				        if(!err) {
					    	server.quickrJSON(response, 200, doc);
						} else {
							server.quickr(response, 409);
							server.echo('> COUCHDB document ' + pid + ' not found'.red, err.message);
						}
				    });
			 	}

			} else {
				server.quickr(response, 400);
				server.echo('> COUCHDB "id" parameter is required'.red);
			}

		} else if(request.method == 'PUT') {

			var pid = request.path.query.id;
			var prev = request.path.query.rev;

			get(pid, function(err, doc) {

				if(!err) {

					doc = request.data;

					insert(pid, doc, function(err, doc) {
						if(!err) {
					    	server.quickrJSON(response, 200, doc);
					    	server.echo('> COUCHDB document ' + pid.magenta + ' updated'.green);
						} else {
							server.quickrJSON(response, 409, doc);
							server.echo('> COUCHDB document ' + pid.magenta + ' not updated'.red, err.message);
						}
					});
				} else {
					server.quickr(response, 409);
					server.echo('> COUCHDB document ' + pid + ' not found'.red, err.message);
				}
			});

		} else if(request.method == 'POST') {

			var doc = request.data;

			insert(doc.id, doc, function(err, doc) {
				if(!err) {
			    	server.echo('> COUCHDB document created'.green);
			    	server.quickrJSON(response, 201, doc);
				} else {
					server.echo('> COUCHDB document not created'.red, err.message);
					server.quickrJSON(response, 409, doc);
				}

			});
		
		} else if(request.method == 'DELETE') {

			var pid = request.path.query.id;
			var prev = request.path.query.rev;

			destroy(pid, prev, function(err, doc) {
				if(!err) {
			    	server.echo('> COUCHDB document ' + pid.magenta + ' destroyed'.green);
			    	server.quickrJSON(response, 200, doc);
				} else {
					server.echo('> COUCHDB ' + pid.magenta + ' not destroyed'.red, err.message);
					server.quickrJSON(response, 202, doc);
				}
			});

		} else {

			server.quickr(response, 501);
			server.echo('> Request is not implemented'.red);
		}

	};

	return {
		connect: connect,
		get: get,
		getAll: getAll,
		insert: insert,
		destroy: destroy,
		use: use,
		run: run
	};

})();

couchdb.connect(application.config.couchdb.host, application.config.couchdb.port, application.config.couchdb.protocol);
couchdb.use(application.config.couchdb.dbname);

// Register controller
server.controllers.register('couchdb', couchdb);

// Export controller (to direct use)
module.exports = couchdb;