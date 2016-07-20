const Path = require('path');
const Fs = require('fs');

NEWSCHEMA('Package').make(function(schema) {

	schema.define('id', 'UID', true);
	schema.define('filename', 'String(200)');
	schema.define('remove', Boolean);

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

		callback();
	});

	schema.addWorkflow('stop', function(error, model, options, callback) {
		SuperAdmin.kill(model.app.port, function() {
			setTimeout(() => callback(SUCCESS(true)), 1000);
		});
	});

	schema.addWorkflow('restart', function(error, model, options, callback) {
		SuperAdmin.run(model.app.port, function(err) {
			if (err)
				error.push('restart', err);
			callback(SUCCESS(true));
		});
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
				}, () => () => callback(SUCCESS(true)));
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

			F.unlink([filename], NOOP);
			SuperAdmin.makescripts(model.app, function(err) {
				if (err)
					error.push('executable', err);
				callback(SUCCESS(true));
			});
		});
	});
});