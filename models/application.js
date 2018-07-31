const Fs = require('fs');
const Path = require('path');
const Exec = require('child_process').exec;
const FLAGS = ['get', 'dnscache'];

NEWSCHEMA('Application').make(function(schema) {

	schema.define('id',            'UID');
	schema.define('url',           'Url', true);
	schema.define('path',          'String(100)');
	schema.define('category',      'String(50)');
	schema.define('redirect',      '[String]');
	schema.define('allow',         '[String]');
	schema.define('disallow',      '[String]');
	schema.define('ssl_key',       'String');
	schema.define('ssl_cer',       'String');
	schema.define('git',           'String');                  // URL to GIT repository
	schema.define('notes',         'String');
	schema.define('startscript',   'String');                  // A start script
	schema.define('nginx',         'String');                  // Additional NGINX settings (lua)
	schema.define('delay',          Number);                   // Delay after start
	schema.define('memory',         Number);                   // Memory limit
	schema.define('priority',       Number);                   // Start priority
	schema.define('port',           Number);
	schema.define('cluster',        Number);                   // Thread count
	schema.define('ddos',           Number);                   // Maximum count of request per second
	schema.define('size',           Number);                   // Maximum size of request body (upload size)
	schema.define('proxytimeout',   Number);                   // Sets the "proxy_read_timeout"
	schema.define('debug',          Boolean);                  // Enables debug mode
	schema.define('subprocess',     Boolean);
	schema.define('npm',            Boolean);                  // Performs NPM install
	schema.define('renew',          Boolean);                  // Performs renew
	schema.define('accesslog',      Boolean);                  // Enables access_log
	schema.define('backup',         Boolean);                  // Enables backup

	schema.setQuery(function(error, options, callback) {
		callback(APPLICATIONS);
	});

	schema.setSave(function(error, model, options, callback) {

		var plain = model.$plain();

		plain.linker = model.linker = model.url.superadmin_linker(model.path);
		plain.renew = undefined;

		if (model.id) {
			var index = APPLICATIONS.findIndex('id', model.id);

			if (index === -1) {
				error.push('error-app-404');
				return callback();
			}

			var app = APPLICATIONS[index];
			if (app.linker !== model.linker) {
				error.push('error-app-linker');
				return callback();
			}

			model.$repository('restart', app.cluster !== model.cluster || model.debug !== app.debug);
			APPLICATIONS[index] = plain;
			plain.dateupdated = F.datetime;
			EMIT('superadmin.app.update', plain, index);

		} else {
			plain.id = model.id = UID();
			plain.datecreated = F.datetime;
			APPLICATIONS.push(plain);
			EMIT('superadmin.app.create', plain);
			model.$repository('restart', true);
		}

		SuperAdmin.save(null, true);
		model.renew && model.$push('workflow', 'renew');
		callback(SUCCESS(true, model.id));
	});

	schema.setGet(function(error, model, id, callback) {
		var item = APPLICATIONS.findItem('id', id);
		!item && error.push('error-app-404');
		callback(item);
	});

	// Reads info
	schema.addWorkflow('info', function(error, model, options, callback) {
		APPLICATIONS.wait(function(item, next) {

			if (item.stopped || F.global.RESTARTING)
				return next();

			SuperAdmin.pid2(item, function(err, pid) {
				if (err) {
					SuperAdmin.run(item.port, () => next());
					SuperAdmin.notify(item, 0);
					EMIT('superadmin.app.restart', item);
				} else
					SuperAdmin.appinfo(pid, next, item);
			});
		}, function() {
			SuperAdmin.savestats();
			callback(SUCCESS(true));
		}, 2);
	});

	// Reads logs
	schema.addWorkflow('logs', function(error, model, id, callback) {
		var item = APPLICATIONS.findItem('id', id);
		if (!item) {
			error.push('error-app-404');
			return callback();
		}

		Fs.readFile(item.debug ? Path.join(CONFIG('directory-www'), item.linker, 'logs', 'debug.log') : Path.join(CONFIG('directory-console'), item.linker + '.log'), function(err, response) {
			callback(err ? '' : response.toString('utf8'));
		});
	});

	// Checks port number
	schema.addWorkflow('check', function(error, model, options, callback) {

		var item;

		if (model.subprocess) {
			item = APPLICATIONS.findItem(n => n.url === model.url && !n.subprocesse);
			!item && error.push('error-url-noexist');
		} else {
			item = APPLICATIONS.findItem('url', model.url);
			item && item.id !== model.id && error.push('error-url-exists');
		}

		callback();
	});

	// Checks port number
	schema.addWorkflow('port', function(error, model, options, callback) {
		if (model.port)
			port_check(APPLICATIONS, model.id, model.port) && error.push('error-port');
		else
			model.port = port_create(APPLICATIONS);
		callback(SUCCESS(true));
	});

	// Checks directory
	schema.addWorkflow('directory', function(error, model, options, callback) {
		var filename = Path.join(CONFIG('directory-www'), model.linker, 'release.js');
		F.path.exists(filename, function() {
			model.$repository('restart', true);
			callback(SUCCESS(true));
		});
	});

	schema.setRemove(function(error, id, callback) {
		var index = APPLICATIONS.findIndex('id', id);
		if (index === -1) {
			error.push('error-app-404');
			return callback();
		}

		var app = APPLICATIONS[index];

		SuperAdmin.kill(app.port, function() {
			var linker = app.linker;
			var directory = Path.join(CONFIG('directory-www'), linker);

			// Backups application's data
			Exec('bash {0} {1} {2}'.format(F.path.databases('backup.sh'), Path.join(CONFIG('directory-www'), linker), Path.join(CONFIG('directory-dump'), linker + '-removed-backup.tar.gz')), function(err, response) {
				Exec('rm -r ' + directory, function() {

					callback(SUCCESS(true));
					EMIT('superadmin.app.remove', app);

					APPLICATIONS.splice(index, 1);
					SuperAdmin.save(null, true);

					if (app.subprocess) {
						var master = APPLICATIONS.findItem(n => n.url === app.url && !n.subprocess);
						master && schema.workflow('nginx', master, NOOP);
					}

					// Removes app directory
					Exec('rm ' + directory, NOOP);

					// Removes nginx config
					!app.subprocess && F.unlink([Path.join(CONFIG('directory-nginx'), linker + '.conf')], NOOP);
				});
			});
		});
	});

	schema.addWorkflow('renew', function(error, model, options, callback) {
		var url = model.url.superadmin_url();
		var second;

		if (url.startsWith('www.'))
			second = url.substring(4);
		else if (url.count('.') === 1)
			second = 'www.' + url;

		if (second && APPLICATIONS.findItem('url', 'https://' + second))
			second = undefined;

		SuperAdmin.ssl(url, model.ssl_cer ? false : true, function(err) {

			if (err) {
				error.push(err);
				return callback();
			}

			var app = APPLICATIONS.findItem('id', model.id);

			if (app) {
				app.sslexpire = null;
				EMIT('superadmin.app.renew', app);
			}

			callback(SUCCESS(true));

		}, true, second);
	});

	// Analyzes logs
	schema.addWorkflow('analyzator', function(error, model, controller, callback) {

		var output = [];
		var search = controller && controller.query.q ? [controller.query.q.toLowerCase()] : ['\n======= ', 'obsolete', 'error', 'port is already in use', 'deprecationwarning'];
		var length = search.length;

		APPLICATIONS.wait(function(item, next) {

			if (item.stopped)
				return next();

			var type = 0;
			var filename = item.debug ? Path.join(CONFIG('directory-www'), item.linker, 'logs', 'debug.log') : Path.join(CONFIG('directory-console'), item.linker + '.log');
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
					item.analyzatoroutput !== type && EMIT('superadmin.app.analyzator', item);
					item.analyzatoroutput = type;
					output.push({ id: item.id, type: type });
					// @TODO: send sms
					// !controller && SuperAdmin.notify(item, 3);
				} else
					item.analyzatoroutput = null;

				next();
			});

		}, () => callback(output), 2);
	});

	// Creates nginx configuration
	schema.addWorkflow('nginx', function(error, model, options, callback) {

		if (model.subprocess) {

			var item = APPLICATIONS.findItem(n => n.url === model.url && !n.subprocess);
			if (!item) {
				error.push('error-app-master-404-404');
				return callback();
			}

			// Reconfigure main application NGINX settings
			schema.workflow('nginx', item, function(err) {
				if (err) {
					error.push(err);
					callback();
				} else
					model.$repository('restart') ? run(model, () => callback(SUCCESS(true))) : callback(SUCCESS(true));
			});

			return;
		}

		var ssl = model.url.startsWith('https', true);
		var url = model.url.superadmin_url();

		if (!model.linker)
			model.linker = model.url.superadmin_linker(model.path);

		var filename = Path.join(CONFIG('directory-nginx'), model.linker + '.conf');
		var data = {};

		data.url = url;
		data.port = model.port;
		data.ddos = model.ddos;
		data.ssl = ssl;
		data.allow = model.allow;
		data.disallow = model.disallow;
		data.nginx = model.nginx;
		data.proxytimeout = model.proxytimeout;
		data.version = SuperAdmin.nginx;
		data.redirect = [];
		data.size = model.size || 1;
		data.subprocesses = [];
		data.accesslog = model.accesslog;
		data.linker = model.linker;
		data.acmethumbprint = SuperAdmin.options.acmethumbprint;

		// load all subprocesses

		for (var i = 0, length = APPLICATIONS.length; i < length; i++) {
			var item = APPLICATIONS[i];
			if (!item.subprocess || item.url !== model.url)
				continue;
			data.subprocesses.push(item);
		}

		// Prepares redirect
		model.redirect.forEach(url => data.redirect.push(url.superadmin_nginxredirect()));

		data.ssl_cer = model.ssl_cer || (CONFIG('directory-ssl') + url + '/fullchain.cer');
		data.ssl_key = model.ssl_key || (CONFIG('directory-ssl') + url + '/' + url + '.key');

		if (data.ssl) {
			if (url.startsWith('www.'))
				data.second = url.substring(4);
			else if (url.count('.') === 1)
				data.second = 'www.' + url;

			if (data.second && APPLICATIONS.findItem('url', 'https://' + data.second))
				data.second = undefined;

			if (data.second) {
				if (model.ssl_cer) {
					// 3rd-party certificate
					data.second = undefined;
				} else {
					data.second_cer = CONFIG('directory-ssl') + data.second + '/fullchain.cer';
					data.second_key = CONFIG('directory-ssl') + data.second + '/' + data.second + '.key';
				}
			}
		}

		Fs.readFile(F.path.databases('website.conf'), function(err, response) {
			response = response.toString('utf8');
			Fs.writeFile(filename, F.viewCompile(response, data).trim().replace(/\n\t\n/g, '\n').replace(/\n{3,}/g, '\n'), function() {

				if (!ssl) {
					SuperAdmin.reload(function(err) {

						if (err) {
							error.push('nginx', err.toString());
							return callback();
						}

						run(model, () => callback(SUCCESS(true)));
					});
					return;
				}

				SuperAdmin.ssl(url, model.ssl_cer ? false : true, function(err, second_problem) {

					if (err) {
						error.push('ssl', err);
						callback();
						return;
					}

					Fs.readFile(F.path.databases('website-ssl.conf'), function(err, response) {
						response = response.toString('utf8');

						if (second_problem)
							data.second = undefined;

						data.redirect = [];
						model.redirect.forEach(url => data.redirect.push(url.superadmin_nginxredirect()));

						Fs.writeFile(filename, F.viewCompile(response, data).trim().replace(/\n\t\n/g, '\n').replace(/\n{3,}/g, '\n'), function() {
							SuperAdmin.reload(function(err) {

								if (err) {
									error.push('nginx', err.toString());
									return callback();
								}

								if (model.$repository('restart'))
									run(model, () => callback(SUCCESS(true)));
								else
									callback(SUCCESS(true));
							});
						});
					});
				}, undefined, data.second);
			});
		});
	});
});

function run(model, callback) {

	if (model.npm) {
		return SuperAdmin.npminstall(model, function() {
			SuperAdmin.makescripts(model, function() {
				SuperAdmin.restart(model.port, () => callback());
			});
		});
	}

	return SuperAdmin.makescripts(model, function() {
		SuperAdmin.restart(model.port, () => callback());
	});
}

function port_create(arr) {
	var max = 7999;
	arr.forEach((item) => max = Math.max(max, item.port));
	while (true) {
		max++;
		var number = arr.findIndex('port', max);
		if (number === -1)
			return max;
	}
}

function port_check(arr, id, number) {
	var item = arr.findItem('port', number);
	return item ? item.id !== id : false;
}
