const Path = require('path');
const Fs = require('fs');
const Spawn = require('child_process').spawn;
const Exec = require('child_process').exec;

NEWSCHEMA('Templates', function(schema) {

	schema.define('template', String, true);
	schema.define('remove', Boolean);
	schema.define('npm', Boolean);
	schema.define('backup', Boolean);

	schema.setQuery(function($) {
		RESTBuilder.GET('https://raw.githubusercontent.com/totaljs/superadmin_templates/main/superadmin9.json').callback($.callback);
	});

	schema.addWorkflow('check', function($, model) {

		var app = APPLICATIONS.findItem('id', $.id);
		if (!app) {
			$.invalid('404');
			return;
		}

		model.applinker = app.linker;
		model.appdirectory = Path.join(CONF.directory_www, model.applinker);
		model.app = app;
		model.filename = Path.join(CONF.directory_www, app.url.superadmin_linker(app.path), app.id + '.zip');

		if (!model.template) {
			$.invalid('error-template');
			return;
		}

		if (model.template === 'upload') {
			PATH.exists(model.filename, function(e) {
				if (e)
					$.success();
				else
					$.invalid('filename');
			});
			return;
		}

		if (model.template === 'restore') {
			PATH.exists(CONF.directory_dump + model.id + '-backup.tar.gz', function(e) {
				if (e)
					$.success();
				else
					$.invalid('error-restore');
			});
			return;
		}

		DOWNLOAD(model.template, model.appfilename, $.done());
	});

	schema.addWorkflow('stop', function($, model) {
		SuperAdmin.kill(model.app.port, function() {
			setTimeout($.done(), 1000);
		});
	});

	schema.addWorkflow('restart', function($, model) {

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

		run(model.npm, model.app, $.done());
	});

	schema.addWorkflow('backup', function($, model) {
		if (model.backup)
			Exec('bash {0} {1} {2}'.format(PATH.private('backup.sh'), Path.join(CONF.directory_www, model.app.linker), Path.join(CONF.directory_dump, model.id + '-backup.tar.gz')), $.done());
		else
			$.success();
	});

	schema.addWorkflow('remove', function($, model) {

		if (!model.remove) {
			$.success();
			return;
		}

		U.ls(model.appdirectory, function(files, directories) {
			files = files.remove(n => n === model.filename);
			PATH.unlink(files, function() {
				directories.wait(function(item, next) {
					Fs.rmdir(item, () => next());
				}, $.done());
			});
		});
	});

	schema.addWorkflow('unpack', function($, model) {

		var linker = model.app.linker;
		var directory = Path.join(CONF.directory_www, linker);

		// Restore from backup
		if (model.template === 'restore') {
			Exec('tar -xzvf {0} --directory {1} > /dev/null'.format(CONF.directory_dump + model.id + '-backup.tar.gz', directory), function() {
				SuperAdmin.wsnotify('app_template', model.app);
				Spawn('chown', ['-R', SuperAdmin.run_as_user.user, directory]);
				$.success();
			});
		} else {
			// Extract file
			Exec('unzip -o {0}.zip'.format(model.app.id), { cwd: directory }, function() {
				SuperAdmin.wsnotify('app_template', model.app);
				Spawn('chown', ['-R', SuperAdmin.run_as_user.user, directory]);
				$.success();
			});
		}

	});
});

function run(npm, model, callback) {

	if (npm) {
		return SuperAdmin.npminstall(model, function() {
			SuperAdmin.makescripts(model, function() {
				SuperAdmin.restart(model.port, function() {
					SuperAdmin.pid2(model, function(err, pid) {
						pid && SuperAdmin.appinfo(pid, NOOP, model);
					});
					callback && callback();
				});
			});
		});
	}

	return SuperAdmin.makescripts(model, function() {
		SuperAdmin.restart(model.port, function() {
			SuperAdmin.pid2(model, function(err, pid) {
				pid && SuperAdmin.appinfo(pid, NOOP, model);
			});
			callback && callback();
		});
	});
}
