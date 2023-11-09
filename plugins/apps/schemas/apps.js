const Fs = require('fs');
const Path = require('path');

NEWSCHEMA('Apps', function(schema) {

	schema.define('id',             UID);
	schema.define('url',           'String');
	schema.define('name',          'String(50)');
	schema.define('category',      'String(50)');
	schema.define('redirect',      '[String]');
	schema.define('allow',         '[String]');
	schema.define('disallow',      '[String]');
	schema.define('servicemode',    Boolean);
	schema.define('ssl_key',        String);
	schema.define('ssl_cer',        String);
	schema.define('threads',        String);
	schema.define('note',           String);
	schema.define('startscript',    String);                   // A start script
	schema.define('nginx',          String);                   // Additional NGINX settings (lua)
	schema.define('delay',          Number);                   // Delay after start
	schema.define('memory',         Number);                   // Memory limit
	schema.define('priority',       Number);                   // Start priority
	schema.define('port',           Number);
	schema.define('cluster',       'String(4)');               // Thread count number or string - "auto"
	schema.define('ddos',           Number);                   // Maximum count of request per second
	schema.define('size',           Number);                   // Maximum size of request body (upload size)
	schema.define('proxytimeout',   Number);                   // Sets the "proxy_read_timeout"
	schema.define('debug',          Boolean);                  // Enables debug mode
	schema.define('subprocess',     Boolean);
	schema.define('accesslog',      Boolean);                  // Enables access_log
	schema.define('backup',         Boolean);                  // Enables backup
	schema.define('watcher',        Boolean);                  // Enables Total.js watcher for release mode
	schema.define('version',        String);                   // Total.js Version
	schema.define('highpriority',   Boolean);                  // App with high priority
	schema.define('unixsocket',     Boolean);                  // Enables unixsocket
	schema.define('allow80',        Boolean);                  // Disables redirect from HTTP to HTTPS
	schema.define('editcode',       String);                   // A link to the Code Editor

	schema.required('name', model => model.servicemode);
	schema.required('url', model => !model.servicemode);

	schema.action('query', {
		name: 'Apps query',
		action: function($) {
			$.callback(APPLICATIONS);
		}
	});

	schema.action('read', {
		name: 'Read app',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			var item = APPLICATIONS.findItem('id', params.id);
			if (item) {
				item = CLONE(item);
				if (item.subprocess)
					item.url += item.path;
				$.callback(item);
			} else
				$.invalid(404);
		}
	});

	var obtaininginfo = false;

	schema.action('info', {
		name: 'Read info',
		action: function($) {

			if (obtaininginfo) {
				$.success();
				return;
			}

			obtaininginfo = true;

			APPLICATIONS.wait(function(item, next) {

				if (MAIN.restarting) {
					next();
					return;
				}

				if (item.stopped) {

					if (MAIN.ws) {
						var current = {};
						current.id = item.id;
						current.TYPE = 'appinfo';
						current.is = false;
						MAIN.ws.send(current);
					}

					return setImmediate(next);
				}

				SuperAdmin.pid2(item, function(err, pid) {
					if (err) {
						SuperAdmin.run(item.port, () => next());
						SuperAdmin.wsnotify('app_restart', item);
						EMIT('superadmin_app_restart', item);
					} else
						SuperAdmin.appinfo(pid, next, item);
				});

			}, function() {
				obtaininginfo = false;
				SuperAdmin.savestats();
				$.success();
			}, 2);
		}
	});

	schema.action('analyzator', {
		name: 'Analyze logs',
		query: 'q:String',
		action: function($) {
			var query = $.query;
			var output = [];
			var search = query.q ? [query.q.toLowerCase()] : ['\n======= ', 'obsolete', 'error', 'port is already in use', 'deprecationwarning'];
			var length = search.length;

			APPLICATIONS.wait(function(item, next) {

				if (item.stopped)
					return next();

				var type = 0;
				var filename = Path.join(CONF.directory_www, item.linker, 'logs', 'debug.log');
				var stream = Fs.createReadStream(filename);

				stream.on('data', U.streamer('\n', function(chunk) {

					if (type)
						return false;

					chunk = chunk.toLowerCase();

					for (var i = 0; i < length; i++) {
						if (chunk.indexOf(search[i]) !== -1) {
							type = search[i].startsWith('\n===') ? 'error' : search[i];
							return false;
						}
					}

				}));

				CLEANUP(stream, function() {

					if (type) {

						if (item.analyzatoroutput !== type)
							EMIT('superadmin_app_analyzator', item);

						item.analyzatoroutput = type;
						var e = { id: item.id, type: type, url: item.url };
						output.push(e);
					} else
						item.analyzatoroutput = null;

					next();
				});

			}, () => $.callback(output), 2);
		}
	});

	schema.action('logs', {
		name: 'Read logs',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			var item = APPLICATIONS.findItem('id', params.id);
			if (item) {
				Fs.readFile(Path.join(CONF.directory_www, item.linker, 'logs', 'debug.log'), function(err, response) {
					$.controller.plain(err ? '' : response.toString('utf8'));
					$.cancel();
				});
			} else
				$.invalid(404);
		}
	});

	schema.action('restart', {
		name: 'Restart app',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			var app = APPLICATIONS.findItem('id', params.id);
			if (!app) {
				$.invalid('404');
				return;
			}

			SuperAdmin.logger('restart: {0}', $, app);
			EMIT('superadmin_app_restart', app);

			app.current = null;
			app.analyzatoroutput = null;

			if (app.stopped) {

				app.stopped = false;
				SuperAdmin.save();

				if (app.url.startsWith('https://')) {

					// NGINX check due to SSL
					TASK('nginx/init', $.successful(function() {

						app.current = null;
						app.analyzatoroutput = null;

						SuperAdmin.wsnotify('app_restart', app);
						SuperAdmin.restart(app.port, $.successful(function() {
							SuperAdmin.pid2(app, function(err, pid) {
								pid && SuperAdmin.appinfo(pid, NOOP, app);
							});
						}));

						$.success();

					}), $).value = app;

					return;
				}
			}

			SuperAdmin.wsnotify('app_restart', app);
			SuperAdmin.restart(app.port, $.successful(function() {
				SuperAdmin.pid2(app, function(err, pid) {
					pid && SuperAdmin.appinfo(pid, NOOP, app);
				});
			}));

			$.success();
		}
	});

	schema.action('restart_all', {
		name: 'Restart all apps',
		query: 'version:String',
		action: function($) {
			var query = $.query;
			SuperAdmin.wsnotify('apps_restart');
			MAIN.restarting = true;

			APPLICATIONS.wait(function(app, next) {

				if (app.stopped || (query.version && app.version !== query.version)) {
					next();
					return;
				}

				app.current = null;
				app.analyzatoroutput = null;
				SuperAdmin.wsnotify('app_restart', app);
				SuperAdmin.restart(app.port, () => next());

			}, function() {

				MAIN.restarting = false;

				// Obtain apps info
				$WORKFLOW('apps', 'info', NOOP);

				// Alternative:
				// CALL('Apps --> info').callback(NOOP);

			});

			$.success();
		}
	});

	schema.action('check', {
		name: 'Checks url',
		action: async function($, model) {
			var url = model.url.superadmin_clean();

			model.path = model.url.substring(url.length);

			if (model.path === '/')
				model.path = '';

			model.url = url;
			model.subprocess = !!model.path;

			if (model.servicemode) {
				$.success();
				return;
			}

			if (!model.url) {
				$.invalid('@(Invalid URL address)');
				return;
			}

			var item;

			if (model.subprocess) {
				item = APPLICATIONS.findItem(n => n.url === model.url && !n.subprocess);
				if (item)
					$.success();
				else
					$.invalid(404);
			} else {
				item = APPLICATIONS.findItem('url', model.url);
				if (item && item.id !== model.id)
					$.invalid('@(The URL address is already registered in the database)');
				else
					$.success();
			}
		}
	});

	schema.action('port', {
		name: 'Checks port number',
		action: function($, model) {
			if (model.port) {
				if (port_check(APPLICATIONS, model.id, model.port)) {
					$.invalid('@(The PORT number is already in use)');
					return;
				}
			} else
				model.port = port_create(APPLICATIONS);
			$.success();
		}
	});

	schema.action('save', {
		name: 'Save app',
		action: async function($, model) {
			var item = CLONE(model);
			var newbie = !model.id;

			if (!model.servicemode) {
				item.linker = model.linker = item.url.superadmin_linker(model.path);
				if (!item.linker) {
					$.invalid('@(Invalid URL address)');
					return;
				}
			}

			if (item.version === 'total3')
				item.threads = '';

			item.restart = undefined;
			item.ssl = model.ssl = item.url.startsWith('https://');

			if ((item.unixsocket && (item.version !== 'total4' && item.version !== 'total5')) || !CONF.unixsocket)
				item.unixsocket = false;

			if (item.id) {

				var index = APPLICATIONS.findIndex('id', model.id);

				if (index === -1) {
					$.invalid(404);
					return;
				}

				var app = APPLICATIONS[index];

				if (model.servicemode) {
					item.url = app.url;
					item.linker = model.linker = item.url.superadmin_linker(model.path);
				} else {
					if (app.linker !== model.linker) {
						$.invalid('@(The URL address is already registered in the database)');
						return;
					}
				}

				model.restart = app.cluster !== model.cluster || model.debug !== app.debug || model.version !== app.version || model.unixsocket !== app.unixsocket || model.editcode !== app.editcode;
				item.current = app.current;
				item.analyzatoroutput = app.analyzatoroutput;
				item.dtupdated = NOW;

			} else {

				item.id = model.id = UID();
				item.dtcreated = NOW;
				model.restart = true;

				if (item.servicemode) {
					item.url = 'service-' + item.name.slug() + '-' + Date.now().toString(36);
					item.linker = model.linker = item.url.superadmin_linker();
				}

			}

			var callback = function() {

				if (newbie) {
					SuperAdmin.wsnotify('app_create', item);
					APPLICATIONS.push(item);
					EMIT('superadmin_app_create', item);
				} else {
					SuperAdmin.wsnotify('app_update', item);
					APPLICATIONS[index] = item;
					EMIT('superadmin_app_update', item, index);
				}

				item.current = null;
				item.analyzatoroutput = null;

				model.restart && SuperAdmin.restart(item.port, $.successful(function() {
					SuperAdmin.pid2(item, function(err, pid) {
						pid && SuperAdmin.appinfo(pid, NOOP, item);
					});
				}));

				SuperAdmin.save(null, true);
				$.success(item.id);

				MAIN.ws.send({ TYPE: 'refresh' });
			};

			if (item.servicemode)
				callback();
			else
				TASK('nginx/init', $.successful(callback), $).value = item;
		}
	});

	function removeapp($, id, callback) {

		var index = APPLICATIONS.findIndex('id', id);
		if (index === -1) {
			callback('404');
			return;
		}

		var app = APPLICATIONS[index];

		SuperAdmin.kill(app.port, function() {

			var linker = app.linker;
			var directory = Path.join(CONF.directory_www, linker);

			// Backups application's data
			SHELL('bash {0} {1} {2}'.format(PATH.private('backup.sh'), Path.join(CONF.directory_www, linker), Path.join(CONF.directory_dump, linker + '-removed-backup.tar.gz')), function() {
				SHELL('rm -r ' + directory, function() {

					EMIT('superadmin_app_remove', app);

					APPLICATIONS.splice(index, 1);
					SuperAdmin.save(null, true);

					var remove = [];

					if (!app.subprocess) {
						// remove all subprocesses
						for (var sub of APPLICATIONS) {
							if (sub.subprocess && sub.url === app.url)
								remove.push(sub);
						}
					}

					// Removes app directory
					SHELL('rm ' + directory, NOOP);

					// Removes nginx config
					if (app.subprocess) {

						var parent = APPLICATIONS.findItem(n => n.url === app.url && !n.subprocess);
						if (parent)
							TASK('nginx/init', ERROR('Remove.nginx'), $).value = parent;

					} else
						PATH.unlink([Path.join(CONF.directory_nginx, linker + '.conf')], NOOP);

					if (remove.length) {
						remove.wait(function(item, next) {
							removeapp($, item.id, next);
						}, callback);
					} else {
						MAIN.ws.send({ TYPE: 'refresh' });
						callback();
					}
				});
			});
		});
	}

	schema.action('remove', {
		name: 'Remove app',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			removeapp($, params.id, $.done());
		}
	});

	schema.action('stop', {
		name: 'Stop app',
		params: '*id:UID',
		action: function($) {
			var params = $.params;
			var app = APPLICATIONS.findItem('id', params.id);
			if (!app) {
				$.invalid(404);
				return;
			}

			SuperAdmin.wsnotify('app_stop', app);
			SuperAdmin.logger('stop: {0}', $, app);
			SuperAdmin.kill(app.port, $.done());

			if (!app.stopped) {
				app.stopped = true;
				app.current = null;
				SuperAdmin.save(null, true);
			}

			if (MAIN.ws) {
				var current = {};
				current.id = app.id;
				current.TYPE = 'appinfo';
				current.is = false;
				current.analyzator = null;
				MAIN.ws.send(current);
			}
		}
	});

	schema.action('stop_all', {
		name: 'Stop all apps',
		action: function($) {
			SuperAdmin.wsnotify('apps_stop');
			SuperAdmin.logger('stops: all', $);

			APPLICATIONS.wait(function(item, next) {

				if (item.stopped) {
					next();
					return;
				}

				item.stopped = true;
				item.current = null;

				SuperAdmin.kill(item.port, function() {
					if (MAIN.ws) {
						var current = {};
						current.id = item.id;
						current.TYPE = 'appinfo';
						current.analyzator = null;
						MAIN.ws.send(current);
					}
					next();
				});

			}, function() {
				SuperAdmin.save(null, true);
				$.success();
			});
		}
	});


});

function port_create(arr) {
	var max = 7999;
	for (var i = 0; i < arr.length; i++) {
		var item = arr[i];
		if (item.port > max)
			max = item.port;
	}
	return max + 1;
}

function port_check(arr, id, number) {
	var item = arr.findItem('port', number);
	return item ? item.id !== id : false;
}
