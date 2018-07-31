const Path = require('path');
const Fs = require('fs');
const Spawn = require('child_process').spawn;
const Exec = require('child_process').exec;

NEWSCHEMA('Package').make(function(schema) {

	schema.define('id', 'UID', true);
	schema.define('filename', 'String(200)');
	schema.define('template', 'String(500)');
	schema.define('remove', Boolean);
	schema.define('npm', Boolean);
	schema.define('backup', Boolean);

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

		if (!model.template || model.template === 'git')
			return callback();

		if (model.template === 'restore') {

			if (model.backup) {
				error.push('error-backup');
				return callback();
			}

			F.path.exists(CONFIG('directory-dump') + model.id + '-backup.tar.gz', function(e) {
				!e && error.push('error-restore');
				callback();
			});
			return;
		}

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

		if (model.app.stats) {
			if (model.app.stats.restart)
				model.app.stats.restart++;
			else
				model.app.stats.restart = 1;
		}

		run(model.npm, model.app, () => callback(SUCCESS(true)));
	});

	schema.addWorkflow('backup', function(error, model, options, callback) {
		if (model.backup) {
			Exec('bash {0} {1} {2}'.format(F.path.databases('backup.sh'), Path.join(CONFIG('directory-www'), model.app.linker), Path.join(CONFIG('directory-dump'), model.id + '-backup.tar.gz')), function(err) {
				err && error.push('backup', err);
				callback();
			});
		} else
			callback();
	});

	schema.addWorkflow('remove', function(error, model, options, callback) {

		if (!model.remove)
			return callback();

		U.ls(model.appdirectory, function(files, directories) {

			// package
			var a = model.appfilename;
			var b = model.appfilename.replace(/\.package$/i, '.zip');

			files = files.remove(n => n === a || n === b);

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

		if (model.template === 'restore') {

			if (model.app.stats) {
				if (model.app.stats.restore)
					model.app.stats.restore++;
				else
					model.app.stats.restore = 1;
			}

			Exec('tar -xzvf {0} --directory {1} > /dev/null'.format(CONFIG('directory-dump') + model.id + '-backup.tar.gz', directory), function() {
				Spawn('chown', ['-R', SuperAdmin.run_as_user.user, directory]);
				callback(SUCCESS(true));
			});

			return;

		} else if (model.template === 'git') {

			if (model.app.stats) {
				if (model.app.stats.git)
					model.app.stats.git++;
				else
					model.app.stats.git = 1;
			}

			Exec('bash {0} "{1}" "{2}"'.format(F.path.databases('git.sh'), model.app.git, directory), function() {
				Spawn('chown', ['-R', SuperAdmin.run_as_user.user, directory]);
				callback(SUCCESS(true));
			});

			return;
		}

		var ext = U.getExtension(model.filename) || 'package';
		var filename = Path.join(directory, model.app.id + '.' + ext);

		if (ext === 'zip') {
			Exec('unzip {0}.zip'.format(model.app.id), { cwd: directory }, function() {
				if (model.app.stats) {
					if (model.app.stats.template)
						model.app.stats.template++;
					else
						model.app.stats.template = 1;
				}
				Spawn('chown', ['-R', SuperAdmin.run_as_user.user, directory]);
				callback(SUCCESS(true));
			});
			return;
		}

		F.restore(filename, directory, function(err) {

			F.unlink([filename], F.error());

			if (err) {
				error.push(err);
				return callback();
			}

			if (model.app.stats) {
				if (model.app.stats.template)
					model.app.stats.template++;
				else
					model.app.stats.template = 1;
			}

			Spawn('chown', ['-R', SuperAdmin.run_as_user.user, directory]);
			callback(SUCCESS(true));
		});
	});
});

function run(npm, model, callback) {

	if (npm) {
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
