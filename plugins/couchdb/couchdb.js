var http			= require('http');

//https://github.com/dscape/nano
var nano		 	= require('nano');

server;

var CouchDB = (function() {

	var use = function(dbname) {
		this._db = this._conn.use(dbname);
	};

	var connect = function(host, port, protocol) {
		return this._conn = nano((protocol || 'http') + '://' + host + ':' + port);
	};

	var get = function(id, fn) {
 		this._db.get(id, fn);
	};

	var getAll = function(fn, opts) {
		opts = opts || {};
		opts.revs_info = true;
		opts.include_docs = true;
 		this._db.list(opts, fn);
	};

	var insert = function(id, doc, fn) {
		this._db.insert(doc, id,  function(err, xdoc) {
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
		this._db.destroy(id, rev, fn);
	};

	var run = function(response, request, params) {
		
		if(request.method == 'GET') {

			var pid 	= request.path.query.id;

			if(pid) {

				if(pid == '*') {
			 		this.getAll(function(err, docs) {
				        if(!err) {
					    	server.quickrJSON(response, 200, docs.rows);
						} else {
							server.echo('> COUCHDB documents not found'.red, err.message);
							server.quickr(response, 404);
						}
				    });
				} else {
			 		this.get(pid, function(err, doc) {
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

			this.get(pid, function(err, doc) {

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

			this.insert(doc.id, doc, function(err, doc) {
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

			this.destroy(pid, prev, function(err, doc) {
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
			server.echo('> COUCHDB Request is not implemented'.red);
		}

	};

	var constructor = function() {
		this.connect = connect;
		this.get = get;
		this.getAll = getAll;
		this.insert = insert;
		this.destroy = destroy;
		this.use = use;
		this.run = run;
	}

	return constructor;

})();

// Export controller (to direct use)
module.exports = CouchDB;