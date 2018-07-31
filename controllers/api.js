const Path = require('path');
const Exec = require('child_process').exec;
const FLAGS = ['get', 'dnscache'];

exports.install = function() {

	ROUTE('/api/apps/',              json_query,            ['authorize', '*Application']);
	ROUTE('/api/apps/',              json_apps_save,        ['authorize', 'post', '*Application', 50000]);
	ROUTE('/api/apps/info/',         json_apps_info,        ['authorize']);
	ROUTE('/api/stats/',             json_stats,            ['authorize', 20000]);
	ROUTE('/api/apps/analyzator/',   json_analyzator,       ['authorize', '*Application', 20000]);
	ROUTE('/api/apps/{id}/',         json_read,             ['authorize', '*Application']);
	ROUTE('/api/apps/{id}/restart/', json_apps_restart,     ['authorize', '*Application', 20000]);
	ROUTE('/api/apps/{id}/stop/',    json_apps_stop,        ['authorize', '*Application', 20000]);
	ROUTE('/api/apps/{id}/remove/',  json_apps_remove,      ['authorize', 'delete', '*Application', 20000]);
	ROUTE('/api/apps/{id}/pack/',    file_apps_pack,        ['authorize', '*Application', 120000]);
	ROUTE('/api/apps/restart/',      json_apps_restart,     ['authorize', '*Application', 50000]);
	ROUTE('/api/apps/stop/',         json_apps_stop,        ['authorize', '*Application', 50000]);
	ROUTE('/api/apps/reconfigure/',  json_apps_reconfigure, ['authorize', '*Application', 120000]);
	ROUTE('/api/apps/upload/',       json_apps_upload,      ['authorize', 'upload', 120000], 1024 * 50); // Max 50 MB
	ROUTE('/api/apps/unpack/',       json_apps_unpack,      ['authorize', 'post', '*Package', 120000]);
	ROUTE('/api/apps/backup/',       json_apps_backup,      ['authorize', 500000]);
	ROUTE('/api/templates/',         json_templates,        ['authorize']);
	ROUTE('/api/logs/',              json_logs,             ['authorize']);
	ROUTE('/api/permissions/',       json_permissions,      ['authorize']);
	ROUTE('/api/notifications/',     json_notifications,    ['authorize']);
	ROUTE('/api/last/',              json_last,             ['authorize']);
	ROUTE('/api/nginx/',             json_nginx,            ['authorize']);
	ROUTE('/api/login/',             json_login,            ['unauthorize', 'post', '*Login']);
	ROUTE('/logs/{id}/',             json_apps_logs,        ['authorize', '*Application']);
	ROUTE('/api/alarms/',            json_save,             ['authorize', 'post', '*Alarm']);
	ROUTE('/api/alarms/',            json_query,            ['authorize', '*Alarm']);
	ROUTE('/api/alarms/',            json_remove,           ['authorize', 'delete', '*Alarm']);
	ROUTE('/api/settings/',          json_save,             ['authorize', 'post', '*Settings']);
	ROUTE('/api/settings/',          json_settings_read,    ['authorize']);
	ROUTE('/api/apps/stats/',        json_apps_stats,       ['authorize']);

	if (CONFIG('allow-filebrowser')) {
		ROUTE('/api/filebrowser/',       json_query,        ['authorize', '*FileBrowser']);
		ROUTE('/api/filebrowser/{id}/',  json_read_file,    ['authorize', '*FileBrowser']);
		ROUTE('/api/filebrowser/',       json_save,         ['authorize', '*FileBrowser', 'post']);
		ROUTE('/api/filebrowser/',       json_fb_upload,    ['authorize', 'upload'], 1024 * 20); // Max 20 MB
	}

};

function json_logs() {
	var self = this;
	SuperAdmin.logger('system: SuperAdmin logs', self);
	Exec('tail -n 50 ' + F.path.logs('logger.log'), self.callback());
}

function json_last() {
	var self = this;
	SuperAdmin.logger('system: Server last', self);
	Exec('last', self.callback());
}

function json_nginx() {
	var self = this;
	SuperAdmin.logger('system: Nginx config test', self);
	Exec(SuperAdmin.options.nginxpath + ' -t', (e, r, m) => self.json(m));
}

function json_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

function json_save() {
	var self = this;
	self.$save(self.query, self.callback());
}

function json_remove() {
	var self = this;
	self.$remove(self.body, self.callback());
}

function json_read(id) {
	var self = this;
	SuperAdmin.logger('read: {0}', self, id);
	self.$read(id, self.callback());
}

function json_read_file(id) {
	var self = this;
	SuperAdmin.logger('read file: {0}', self, id + ' - ' + self.query.filename);
	self.$read(id, self.callback());
}

function json_apps_save() {
	var self = this;
	SuperAdmin.logger('save: {0}', self, self.body.id);
	self.$async(self.callback(), 2).$workflow('check').$workflow('port').$save().$workflow('directory').$workflow('nginx');
}

function json_apps_info() {

	var self = this;
	var output = [];

	for (var i = 0, length = APPLICATIONS.length; i < length; i++) {
		var item = APPLICATIONS[i];
		!item.stopped && item.current && output.push(item.current);
	}

	self.json(output);
}

function json_apps_remove(id) {
	var self = this;
	SuperAdmin.logger('remove: {0}', self, id);
	self.$remove(id, self.callback());
}

function json_apps_restart(id) {
	var self = this;

	if (id) {
		var app = APPLICATIONS.findItem('id', id);
		if (!app)
			return self.invalid().push('error-app-404');

		SuperAdmin.logger('restart: {0}', self, app);
		F.emit('applications.restart', app);
		app.current = null;
		app.analyzatoroutput = null;

		SuperAdmin.restart(app.port, () => self.json(SUCCESS(true)));

		if (app.stopped) {
			app.stopped = false;
			SuperAdmin.save();
		}

		return;
	}

	if (F.global.RESTARTING) {
		self.json(SUCCESS(false));
		return;
	}

	F.global.RESTARTING = true;

	SuperAdmin.logger('restart: all', self);
	APPLICATIONS.wait(function(item, next) {

		if (item.stopped)
			return next();

		F.emit('applications.restart', item);
		item.current = null;
		SuperAdmin.restart(item.port, next);

	}, function() {
		F.global.RESTARTING = false;
		SuperAdmin.save();
		self.json(SUCCESS(true));
	});
}

function json_apps_stop(id) {
	var self = this;

	// stops all
	if (id) {
		var app = APPLICATIONS.find('id', id);
		if (!app)
			return self.invalid().push('error-app-404');

		SuperAdmin.logger('stop: {0}', self, app);
		SuperAdmin.kill(app.port, (err) => self.json(SUCCESS(true, err)));

		if (!app.stopped) {
			app.stopped = true;
			app.current = null;
			SuperAdmin.save(null, true);
		}

		return;
	}

	SuperAdmin.logger('stop: all', self);
	var errors = [];
	APPLICATIONS.wait(function(item, next) {
		item.stopped = true;
		item.current = null;
		SuperAdmin.kill(item.port, function(err) {
			err && errors.push(err);
			next();
		});
	}, function() {
		SuperAdmin.save(null, true);
		self.json(SUCCESS(true, errors));
	});
}

function json_apps_logs(id) {
	var self = this;
	SuperAdmin.logger('logs: {0}', self, id);
	self.$workflow('logs', id, function(err, response) {
		if (err)
			self.invalid().push(err);
		else
			self.plain(response);
	});
}

function json_apps_reconfigure() {
	var self = this;
	var errors = [];

	SuperAdmin.logger('reconfigure: all', self);

	APPLICATIONS.wait(function(item, next) {
		item.stopped = false;
		var model = $$$('Application').create();
		U.copy(item, model);
		model.$async(function(err) {
			err && errors.push(model.id, err);
			next();
		}).$workflow('check').$workflow('port').$workflow('nginx');
	}, function() {

		SuperAdmin.save(null, true);

		if (!errors.length) {
			self.json(SUCCESS(true));
			return;
		}

		var err = self.invalid();
		for (var i = 0, length = errors.length; i < length; i++)
			err.push(errors[i]);
	});
}

function json_stats() {
	var self = this;
	SuperAdmin.sysinfo((err, response) => self.json(response));
}

function json_apps_stats() {

	var self = this;
	var apps = {};

	APPLICATIONS.forEach(function(item) {
		if (!item.stopped)
			apps[item.url] = true;
	});

	NOSQL('stats').find().make(function(builder) {

		var stats = {};
		var template = { cpu: 0, memory: 0, connections: 0, openfiles: 0, errors: 0, hdd: 0, count: 0, restarts: 0, online: 0 };

		builder.prepare(function(doc) {

			if (!apps[doc.url])
				return;

			var keyA = doc.url;
			var keyB = doc.datecreated.format('yyyy-MM');

			if (!stats[keyA])
				stats[keyA] = {};

			if (!stats[keyA][keyB]) {
				stats[keyA][keyB] = U.clone(template);
				stats[keyA][keyB].key = keyB;
			}

			var item = stats[keyA][keyB];
			item.cpu = Math.max(item.cpu, doc.cpu || 0);
			item.memory = Math.max(item.memory, doc.memory || 0);
			item.connections = Math.max(item.connections, doc.connections || 0);
			item.openfiles = Math.max(item.openfiles, doc.openfiles || 0);
			item.hdd = Math.max(item.hdd, doc.hdd || 0);
			item.restarts += doc.restarts || 0;
			item.errors += doc.errors || 0;
			item.online = Math.max(item.online, doc.online || 0);
			item.count++;
		});

		builder.callback(() => self.json(stats));
	});
}

function json_apps_upload() {
	var self = this;
	var app = APPLICATIONS.findItem('id', self.body.custom);
	if (!app)
		return self.json(SUCCESS(false));

	SuperAdmin.logger('upload: {0}', self, app);

	var file = self.files[0];
	var filename = Path.join(CONFIG('directory-www'), app.url.superadmin_linker(app.path), app.id + '.' + U.getExtension(file.filename));

	file.copy(filename, function(err) {
		if (err)
			return self.invalid().push(err);
		self.json(filename);
	});
}

function json_apps_unpack() {
	var self = this;
	var options = [];

	switch (self.body.template) {
		case 'git':
			options.push('git');
			break;
		case 'restore':
			options.push('restore');
			break;
		default:
			options.push('template');
			break;
	}

	self.body.backup && options.push('backup');
	self.body.npm && options.push('NPM install');
	self.body.remove && options.push('remove all files');

	SuperAdmin.logger('restore: {0}' + (options.length ? ' ({0})'.format(options.join(', ')) : ''), self, self.body.id);
	self.$async(self.callback(), 4).$workflow('check').$workflow('stop').$workflow('backup').$workflow('remove').$workflow('unpack').$workflow('restart');
}

function file_apps_pack(id) {
	var self = this;
	var app = APPLICATIONS.findItem('id', id);
	if (!app)
		return self.invalid().push('error-app-404');

	var linker = app.url.superadmin_linker();
	var directory = Path.join(CONFIG('directory-www'), linker);
	var backup = Path.join(directory, linker + '_backup.zip');

	SuperAdmin.logger('backup: {0}', self, app);

	if (self.query.package) {
		F.backup(backup, directory, () => self.file('~' + backup, U.getName(backup)), (filename) => filename.match(/(\/tmp\/|_backup\.package)/g) ? false : true);
	} else {
		Exec('zip -r {0} .??* * -x \\*.git\\* \\*tmp\\* \\*node_modules\\*'.format(linker + '_backup.zip'), { cwd: directory }, function(err) {
			if (err)
				self.invalid().push(err);
			else
				self.file('~' + backup, U.getName(backup));
		});
	}
}

function json_apps_backup() {
	var self = this;
	SuperAdmin.logger('backup: all', self);
	SuperAdmin.backup(function(err, filename) {
		if (err)
			return self.invalid().push(err);
		self.file('~' + filename, U.getName(filename));
	});
}

function json_templates() {
	var self = this;
	var url = F.global.settings.templates;

	if (!url || !url.isURL())
		return self.json(EMPTYARRAY);

	U.request(url, FLAGS, function(err, response) {
		if (response.isJSON())
			self.content(response, U.getContentType('json'));
		else
			self.json(EMPTYARRAY);
	});
}

function json_login() {
	var self = this;
	SuperAdmin.logger('login', self);
	self.$workflow('exec', self, self.callback());
}

function json_analyzator() {
	var self = this;
	SuperAdmin.logger('analyzator', self);
	self.$workflow('analyzator', self, self.callback());
}

function json_settings_read() {
	this.json(F.global.settings);
}

function json_notifications() {
	var self = this;
	var db = NOSQL('notifications');
	db.find().callback(function(err, response) {
		self.json(response);
		response.length && db.remove();
	});
}

function json_fb_upload() {
	var self = this;

	if (!self.files.length)
		return self.invalid().push('error-file');

	var options = {};

	options.id = self.body.id;
	options.path = self.body.path;
	options.file = self.files[0];

	$WORKFLOW('FileBrowser', 'upload', options, self.callback(), self);
}

function json_permissions() {
	var self = this;
	Exec('chown -R {0}:{1} /www/www/*'.format(SuperAdmin.run_as_user.group, SuperAdmin.run_as_user.id), function(err) {
		if (err)
			self.invalid().push(err);
		else
			self.json(SUCCESS(true));
	});
}