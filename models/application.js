const Fs = require('fs');
const Path = require('path');
const Exec = require('child_process').exec;
const Spawn = require('child_process').spawn;

NEWSCHEMA('Application').make(function(schema) {

	schema.define('id',         'UID');
	schema.define('url',        'Url', true);
	schema.define('path',       'String(100)');
	schema.define('category',   'String(50)');
	schema.define('redirect',   '[String]');
	schema.define('allow',      '[String]');
	schema.define('disallow',   '[String]');
	schema.define('monitor',    'String(50)');              // URL to monitoring
	schema.define('ssl_key',    'String');
	schema.define('ssl_cer',    'String');
	schema.define('notes',      'String');
	schema.define('nginx',      'String');                  // Additional NGINX settings (lua)
	schema.define('delay',       Number);                   // Delay after start
	schema.define('priority',    Number);                   // Start priority
	schema.define('port',        Number);
	schema.define('cluster',     Number);                   // Thread count
	schema.define('ddos',        Number);                   // Maximum count of request per second
	schema.define('size',        Number);                   // Maximum size of request body (upload size)
	schema.define('debug',       Boolean);                  // Enables debug mode
	schema.define('subprocess',  Boolean);

	schema.setQuery(function(error, options, callback) {
		callback(APPLICATIONS);
	});

	schema.setSave(function(error, model, options, callback) {

		var plain = model.$plain();

		plain.linker = model.linker = model.url.superadmin_linker(model.path);

		if (!model.id) {
			plain.id = model.id = UID();
			APPLICATIONS.push(plain);
			F.emit('applications.create', plain);
			model.$repository('restart', true)
		} else {
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
			F.emit('applications.update', plain, index);
		}

		SuperAdmin.save();
		callback(SUCCESS(true));
	});

	schema.setGet(function(error, model, id, callback) {
		var item = APPLICATIONS.findItem('id', id);
		if (!item)
			error.push('error-app-404');
		callback(item);
	});

	// Reads info
	schema.addWorkflow('info', function(error, model, options, callback) {

		var output = [];

		APPLICATIONS.wait(function(item, next) {
			SuperAdmin.pid(item.port, function(err, pid) {

				if (err)
					return next();

				SuperAdmin.appinfo(pid, function(err, response) {

					if (response) {
						response.cluster = item.cluster;
						response.port = item.port;
						response.pid = pid;
						output.push(response);
					}

					next();
				});
			});

		}, () => callback(output), 2);
	});

	// Reads logs
	schema.addWorkflow('logs', function(error, model, id, callback) {
		var item = APPLICATIONS.findItem('id', id);
		if (!item) {
			error.push('error-app-404');
			return callback();
		}

		Fs.readFile(item.debug ? Path.join(CONFIG('directory-www'), item.linker, 'logs', 'debug.log') : Path.join(CONFIG('directory-console'), item.linker + '.log'), function(err, response) {
			if (err)
				return callback('');
			callback(response.toString('utf8'));
		});
	});

	// Checks port number
	schema.addWorkflow('check', function(error, model, options, callback) {

		var item;

		if (model.subprocess) {
			item = APPLICATIONS.findItem(n => n.url === model.url && !n.subprocesse);
			if (!item)
				error.push('error-url-noexist');
		} else {
			item = APPLICATIONS.findItem('url', model.url);
			if (item && item.id !== model.id)
				error.push('error-url-exists');
		}

		callback();
	});

	// Checks port number
	schema.addWorkflow('port', function(error, model, options, callback) {
		if (model.port) {
			if (port_check(APPLICATIONS, model.id, model.port))
				error.push('error-port');
		} else
			model.port = port_create(APPLICATIONS);
		callback(SUCCESS(true));
	});

	// Checks directory
	schema.addWorkflow('directory', function(error, model, options, callback) {
		var filename = Path.join(CONFIG('directory-www'), model.linker, 'release.js');
		F.path.exists(filename, function(e) {
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

			Exec('rm -r ' + directory, function(err) {
				callback(SUCCESS(true));
				APPLICATIONS.splice(index, 1);
				SuperAdmin.save();

				if (app.subprocess) {
					var master = APPLICATIONS.findItem(n => n.url === app.url && !n.subprocess);
					master && schema.workflow('nginx', master, NOOP);
				}

				// Removes nginx config
				!app.subprocess && F.unlink([Path.join(CONFIG('directory-nginx'), linker + '.conf')], NOOP);
			});
		});
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
			schema.workflow('nginx', item, function(err, response) {

				if (err) {
					error.push(err);
					return callback();
				}

				if (model.$repository('restart'))
					return run(model, () => callback(SUCCESS(true)));
				return callback(SUCCESS(true));
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
		data.version = SuperAdmin.nginx;
		data.redirect = [];
		data.size = model.size || 1;
		data.subprocesses = [];

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

		Fs.readFile(F.path.databases('website.conf'), function(err, response) {
			response = response.toString('utf8');
			Fs.writeFile(filename, F.view(response, data).trim().replace(/\n\t\n/g, '\n').replace(/\n{3,}/g, '\n'), function() {

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

				SuperAdmin.ssl(url, model.ssl_cer ? false : true, function(err) {

					if (err) {
						error.push('ssl', err);
						callback();
						return;
					}

					Fs.readFile(F.path.databases('website-ssl.conf'), function(err, response) {
						response = response.toString('utf8');
						data.redirect = model.redirect;
						Fs.writeFile(filename, F.view(response, data).trim().replace(/\n\t\n/g, '\n').replace(/\n{3,}/g, '\n'), function() {
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
				});
			});
		});
	});
});

function run(model, callback) {
	SuperAdmin.makescripts(model, function() {
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
	if (item)
		return item.id !== id;
	return false;
}
