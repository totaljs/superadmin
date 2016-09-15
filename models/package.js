const Path = require('path');
const Fs = require('fs');
const Spawn = require('child_process').spawn;

NEWSCHEMA('Package').make(function(schema) {

	schema.define('id', 'UID', true);
	schema.define('filename', 'String(200)');
	schema.define('template', 'String(500)');
	schema.define('remove', Boolean);
	schema.define('npm', Boolean);

	schema.addWorkflow('check', function(error, model, options, callback) {

		var app = APPLICATIONS.findItem('id', model.id);
		if (!app) {
			error.push('error-app-404');
			return callback();
		}

		model.applinker = app.linker;
		model.appdirectory = Path.join(CONFIG('directory-www'), model.applinker);
		model.appfilename = Path.join(model.appdirectory, app.id + '.package');
		model.app = app;

		if (!model.template)
			return callback();

		U.download(model.template, ['get', 'dnscache'], function(err, response) {

			if (response.statusCode !== 200) {
				error.push('template', response.statusMessage || '@error-template');
				return callback();
			}

			var writer = Fs.createWriteStream(model.appfilename);
			response.pipe(writer);
			response.on('error', (err) => error.push('template', err));
			CLEANUP(writer, () => callback());
		});

	});

	schema.addWorkflow('stop', function(error, model, options, callback) {
		SuperAdmin.kill(model.app.port, function() {
			setTimeout(() => callback(SUCCESS(true)), 1000);
		});
	});

	schema.addWorkflow('restart', function(error, model, options, callback) {

		if (model.app.stopped) {
			model.app.stopped = false;
			SuperAdmin.save(NOOP);
		}

		run(model.npm, model.app, () => callback(SUCCESS(true)));
	});

	schema.addWorkflow('remove', function(error, model, options, callback) {

		if (!model.remove)
			return callback();

		U.ls(model.appdirectory, function(files, directories) {

			// package
			files = files.remove(model.appfilename);

			// Removes Files
			F.unlink(files, function() {
				directories.wait(function(item, next) {
					Fs.rmdir(item, () => next());
				}, () => callback());
			});
		});
	});

	schema.addWorkflow('unpack', function(error, model, options, callback) {

		var linker = model.app.linker;
		var directory = Path.join(CONFIG('directory-www'), linker);
		var filename = Path.join(directory, model.app.id + '.package');

		F.restore(filename, directory, function(err) {

			if (err) {
				error.push(err);
				return callback();
			}

			Spawn('chown', ['-R', SuperAdmin.run_as_user.user, directory]);

			F.unlink([filename], F.error());
			callback(SUCCESS(true));
		});
	});
});

function run(npm, model, callback) {

	if (npm) {
		return SuperAdmin.npminstall(model, function(err) {
			SuperAdmin.makescripts(model, function() {
				SuperAdmin.restart(model.port, () => callback());
			});
		});
	}

	return SuperAdmin.makescripts(model, function() {
		SuperAdmin.restart(model.port, () => callback());
	});
}
