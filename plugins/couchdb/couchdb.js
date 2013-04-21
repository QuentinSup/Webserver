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

	var run = function(response, request, params) {
		
		if(request.method == 'GET') {

			var pid 	= request.path.query.id;

			if(pid) {

				if(pid == '*') {
			 		_db.list({ revs_info: true, include_docs: true }, function(err, docs) {
				        if(!err) {
					    	server.quickrJSON(response, 200, docs.rows);
						} else {
							console.log('> COUCHDB documents not found'.red, err.message);
							server.quickr(response, 404);
						}
				    });
				} else {
			 		_db.get(pid, function(err, doc) {
				        if(!err) {
					    	server.quickrJSON(response, 200, doc);
						} else {
							server.quickr(response, 409);
							console.log('> COUCHDB document ' + pid + ' not found'.red, err.message);
						}
				    });
			 	}

			} else {
				server.quickr(response, 400);
				console.log('> COUCHDB "id" parameter is required'.red);
			}

		} else if(request.method == 'PUT') {

			var pid = request.path.query.id;
			var prev = request.path.query.rev;

			_db.get(pid, function(err, doc) {

				if(!err) {

					doc = request.data;

					_db.insert(doc, pid, function(err, xdoc) {
						if(!err) {
					    	doc._id = xdoc.id;
					    	doc._rev = xdoc.rev;
					    	server.quickrJSON(response, 200, doc);
					    	console.log('> COUCHDB document ' + pid.magenta + ' updated'.green);
						} else {
							server.quickrJSON(response, 409, doc);
							console.log('> COUCHDB document ' + pid.magenta + ' not updated'.red, err.message);
						}

					});
				} else {
					server.quickr(response, 409);
					console.log('> COUCHDB document ' + pid + ' not found'.red, err.message);
				}
			});

		} else if(request.method == 'POST') {

			var doc = request.data;

			_db.insert(doc, doc.id, function(err, xdoc) {
				if(!err) {
			    	console.log('> COUCHDB document created'.green);
			    	doc._id = xdoc.id;
			    	doc._rev = xdoc.rev;
			    	server.quickr(response, 201, JSON.stringify(doc));
				} else {
					console.log('> COUCHDB document not created'.red, err.message);
					server.quickr(response, 409, JSON.stringify(doc));
				}

			});
		
		} else if(request.method == 'DELETE') {

			var pid = request.path.query.id;
			var prev = request.path.query.rev;

			_db.destroy(pid, prev, function(err, doc) {
				if(!err) {
			    	console.log('> COUCHDB document ' + pid.magenta + ' destroyed'.green);
			    	server.quickr(response, 200, JSON.stringify(doc));
				} else {
					console.log('> COUCHDB ' + pid.magenta + ' not destroyed'.red, err.message);
					server.quickr(response, 202, JSON.stringify(doc));
				}
			});

		} else {

			server.quickr(response, 501);
			console.log('> Request is not implemented'.red);
		}

	};

	return {
		connect: connect,
		use: use,
		run: run
	};

})();

couchdb.connect(application.config.couchdb.host, application.config.couchdb.port, application.config.couchdb.protocol);
couchdb.use(application.config.couchdb.dbname);

// Register controller
server.controllers.register('couchdb', couchdb);

// Export controller (to direct use)
exports = couchdb;