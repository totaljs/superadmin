const Fs = require('fs');
const Path = require('path');
const ALLOWED = ['/config', '/config-debug', '/config-release', '/dependencies', '/workflows', '/versions', '/sitemap'];
const SKIP = /\/(tmp|\.git)\//;

NEWSCHEMA('FileBrowser').make(function(schema) {

	schema.define('id', 'UID', true);
	schema.define('filename', 'String(100)', true);
	schema.define('type', ['create', 'remove', 'update', 'rename'], true);
	schema.define('directory', Boolean);
	schema.define('body', String);
	schema.trim = false;

	schema.setQuery(function($) {

		var app = APPLICATIONS.findItem('id', $.controller.query.id);
		if (!app) {
			$.error.push('error-app-404');
			$.callback();
			return;
		}

		var path = F.config['directory-www'] + app.linker + '/';
		SuperAdmin.logger('filebrowser.open: ' + path, $.controller, app);

		U.ls(path, function(files, directories) {

			for (var i = 0, length = files.length; i < length; i++)
				files[i] = files[i].substring(path.length - 1);

			for (var i = 0, length = directories.length; i < length; i++)
				directories[i] = directories[i].substring(path.length - 1);

			$.callback({ files: files, directories: directories, url: app.url, linker: app.linker, id: app.id });

		}, n => !SKIP.test(n));
	});

	schema.setGet(function($) {

		var app = APPLICATIONS.findItem('id', $.options);
		if (!app) {
			$.error.push('error-app-404');
			$.callback();
			return;
		}

		var filename = $.controller.query.filename;
		var ext = U.getExtension(filename);

		switch (ext) {
			case 'cache':
			case 'css':
			case 'htm':
			case 'html':
			case 'js':
			case 'json':
			case 'log':
			case 'md':
			case 'nosql':
			case 'table':
			case 'nosql-log':
			case 'nosql-counter':
			case 'nosql-backup':
			case 'nosql-counter2':
			case 'nosql-mapreduce':
			case 'meta':
			case 'table-meta':
			case 'table-log':
			case 'table-counter':
			case 'table-counter2':
			case 'resource':
			case 'svg':
			case 'txt':
			case 'sql':
			case 'sh':
				break;
			default:

				if (filename.substring(0, 6) === '/.src/')
					filename = filename.substring(5);

				if (ALLOWED.indexOf(filename) === -1) {
					$.error.push('error-file-invalid');
					$.callback();
					return;
				}
				break;
		}

		var path = Path.join(F.config['directory-www'] + app.linker, $.controller.query.filename);

		SuperAdmin.logger('filebrowser.file.read: ' + path, $.controller, app);

		Fs.readFile(path, function(err, response) {
			if (err) {
				$.error.push('error-file');
				$.callback();
			} else
				$.callback(SUCCESS(true, response.toString('utf8')));
		});
	});

	schema.setSave(function($) {

		var model = $.model;
		var app = APPLICATIONS.findItem('id', model.id);
		if (!app) {
			$.error.push('error-app-404');
			$.callback();
			return;
		}

		var path = Path.join(F.config['directory-www'] + app.linker, model.filename);

		if (model.type === 'create') {
			var mkdir = path;
			if (!model.directory)
				mkdir = mkdir.substring(0, mkdir.lastIndexOf('/'));
			F.path.mkdir(mkdir);
		}

		if (model.directory) {

			if (model.type === 'create') {

				SuperAdmin.logger('filebrowser.directory.create: ' + path, $.controller, app);
				F.path.mkdir(path);
				$.callback(SUCCESS(true));
				return;

			} else if (model.type === 'remove') {

				SuperAdmin.logger('filebrowser.directory.remove: ' + path, $.controller, app);
				F.path.rmdir(path, function(err) {
					err && $.error.push(err);
					$.callback(SUCCESS(true));
				});
				return;
			}

		} else {

			if (model.type === 'create' || model.type === 'update') {

				SuperAdmin.logger('filebrowser.file.{0}: '.format(model.type) + path, $.controller, app);
				Fs.writeFile(path, model.body || '', function(err) {
					err && $.error.push(err);
					$.callback(SUCCESS(true));
				});
				return;

			} else if (model.type === 'rename') {
				var target = Path.join(F.config['directory-www'] + app.linker, model.body);
				SuperAdmin.logger('filebrowser.file.rename: ' + path + ' to ' + target, $.controller, app);
				Fs.rename(path, target, function(err) {
					err && $.error.push(err);
					$.callback(SUCCESS(true));
				});

				return;

			} else if (model.type === 'remove') {

				SuperAdmin.logger('filebrowser.file.remove: ' + path, $.controller, app);
				Fs.unlink(path, function(err) {
					err && $.error.push(err);
					$.callback(SUCCESS(true));
				});

				return;

			}
		}

	});

	schema.addWorkflow('upload', function($) {

		var options = $.options;
		var app = APPLICATIONS.findItem('id', options.id);
		if (!app) {
			$.error.push('error-app-404');
			$.callback();
			return;
		}

		var path = Path.join(F.config['directory-www'] + app.linker, options.path);
		var mkdir = path.substring(0, path.lastIndexOf('/'));

		F.path.mkdir(mkdir);

		SuperAdmin.logger('filebrowser.file.upload: ' + path, $.controller, app);
		options.file.move(path, function() {
			$.callback(SUCCESS(true));
		});
	});

});