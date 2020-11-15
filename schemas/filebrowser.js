const Fs = require('fs');
const Path = require('path');
const ALLOWED = ['/config', '/config-debug', '/config-release', '/dependencies', '/workflows', '/versions', '/sitemap'];
const SKIP = /\/(tmp|\.git)\//;

NEWSCHEMA('FileBrowser', function(schema) {

	schema.define('filename', 'String(100)', true);
	schema.define('type', ['create', 'remove', 'update', 'rename'], true);
	schema.define('directory', Boolean);
	schema.define('body', String);
	schema.trim = false;

	schema.setQuery(function($) {

		var app = APPLICATIONS.findItem('id', $.id);
		if (!app) {
			$.invalid('404');
			return;
		}

		var path = CONF.directory_www + app.linker + '/';
		// SuperAdmin.logger('filebrowser.open: ' + path, $.controller, app);

		U.ls(path, function(files, directories) {

			for (var i = 0; i < files.length; i++)
				files[i] = files[i].substring(path.length - 1);

			for (var i = 0; i < directories.length; i++)
				directories[i] = directories[i].substring(path.length - 1);

			$.callback({ files: files, directories: directories, url: app.url, linker: app.linker, id: app.id });

		}, n => !SKIP.test(n));
	});

	schema.setRead(function($) {

		var app = APPLICATIONS.findItem('id', $.id);

		if (!app) {
			$.invalid('404');
			return;
		}

		var filename = $.query.filename;
		var ext = U.getExtension(filename);

		switch (ext) {
			case 'cache':
			case 'css':
			case 'htm':
			case 'html':
			case 'api':
			case 'js':
			case 'json':
			case 'log':
			case 'md':
			case 'nosql':
			case 'table':
			case 'gitignore':
			case 'npmignore':
			case 'bundle':
			case 'package':
			case 'bundlesignore':
			case 'nosql-log':
			case 'nosql-counter':
			case 'nosql-backup':
			case 'nosql-counter2':
			case 'nosql-mapreduce':
			case 'meta':
			case 'counter':
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
					$.invalid('error-file-invalid');
					return;
				}

				break;
		}

		var path = Path.join(CONF.directory_www + app.linker, $.query.filename);

		SuperAdmin.logger('filebrowser.file.read: ' + path, $.controller, app);

		Fs.readFile(path, function(err, response) {
			if (err)
				$.invalid(err);
			else {
				$.controller.binary(response, 'text/plain');
				$.cancel();
			}
		});
	});

	schema.setSave(function($, model) {

		var app = APPLICATIONS.findItem('id', $.id);
		if (!app) {
			$.invalid('404');
			return;
		}

		var path = Path.join(CONF.directory_www + app.linker, model.filename);

		if (model.type === 'create') {
			var mkdir = path;
			if (!model.directory)
				mkdir = mkdir.substring(0, mkdir.lastIndexOf('/'));
			PATH.mkdir(mkdir);
		}

		if (model.directory) {

			if (model.type === 'create') {
				SuperAdmin.logger('filebrowser.directory.create: ' + path, $.controller, app);
				PATH.mkdir(path);
				$.success();
				return;
			} else if (model.type === 'remove') {
				SuperAdmin.logger('filebrowser.directory.remove: ' + path, $.controller, app);
				PATH.rmdir(path, $.done());
				return;
			}

		} else {

			if (model.type === 'create' || model.type === 'update') {
				SuperAdmin.logger('filebrowser.file.{0}: '.format(model.type) + path, $.controller, app);
				Fs.writeFile(path, model.body || '', $.done());
				return;

			} else if (model.type === 'rename') {
				var target = Path.join(CONF.directory_www + app.linker, model.body);
				SuperAdmin.logger('filebrowser.file.rename: ' + path + ' to ' + target, $.controller, app);
				Fs.rename(path, target, $.done());
				return;
			} else if (model.type === 'remove') {
				SuperAdmin.logger('filebrowser.file.remove: ' + path, $.controller, app);
				Fs.unlink(path, $.done());
				return;
			}
		}

	});

	schema.addWorkflow('upload', function($) {

		var app = APPLICATIONS.findItem('id', $.query.id);
		if (!app) {
			$.invalid('404');
			return;
		}

		var path = Path.join(CONF.directory_www + app.linker, $.query.path);
		var mkdir = path.substring(0, path.lastIndexOf('/'));

		PATH.mkdir(mkdir);
		SuperAdmin.logger('filebrowser.file.upload: ' + path, $.controller, app);
		$.files[0].move(path, $.done());
	});

});