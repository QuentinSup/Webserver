	if(fileExtension == 'less') {
									var parser = new(less.Parser)({
								    	paths: [path.dirname(resourcePath)],
								    	filename: resourcePath
									});
									parser.parse(data.toString(), function (err, tree) {
									    if (err) { 
								            // 500 (INTERNAL SERVER ERROR)
								            server.quickr(res, 500, 'LESS_PARSE_ERROR');
								            server.echo('# Less parse error : ', err.message.error);
									    } else {
									    	var mimeType = mime.lookup('less.css');
									    	var css = tree.toCSS({ compress: true });
									    	server.quickr(res, 200, css, mimeType);
									    	fs.mkdir(path.join(conf._cacheDir, path.dirname(pathname)), function() {
										    	fs.writeFile(path.join(conf._cacheDir, pathname + '.css'), css, function(err) {
										    		if(err) {
										    			server.echo('# Unable to cache file : ', resourcePath, err.message.red);
										    		} else {
										    			server.echo('# Update cache file : ', resourcePath);
										    		}
										    	});	
									    	});
									    	
									    }
									});

								} else if(fileExtension == 'coffee') {
									try {
										var js = coffee.compile(data.toString());
										var mimeType = mime.lookup('coffee.js');
										server.quickr(res, 200, js, mimeType);
									} catch(exception) {
							            // 500 (INTERNAL SERVER ERROR)
							            server.quickr(res, 500, 'COFFEESCRIPT_COMPILE_ERROR');
							            server.echo('# Coffee script compile error : ', exception.message.error);
									}
									
								} else {

						        	var mimeType = mime.lookup(resourcePath);
						        	server.quickr(res, 200, data, mimeType);
						        	if(!mimeType) {
						        		server.echo('# No mime type found' .error + ' : file ' + pathname);
						        	}
					        	}