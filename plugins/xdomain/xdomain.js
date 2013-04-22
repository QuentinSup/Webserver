var http = require('http');

server;

var lbc = (function() {
	var run = function(response, request, params) {
		console.log('GET'.info, request.path.query.url);
		http.get(request.path.query.url, function(res) {
			
			var body = '';
			res.setEncoding('ascii');
			
		    res.on("data", function(chunk) {
    			body += chunk;
    			
  			}).on('end', function() {
  				server.quickr(response, 200, body);	
  			});

		}).on('error', function(e) {
		  console.log("Got error: " + e.message);
		  server.quickr(response, 404);
		});
	};

	return {
		run: run
	}

})();

server.controllers.register('xdomain', lbc);

exports = lbc;