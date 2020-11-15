const Path = require('path');
const Exec = require('child_process').exec;

exports.install = function() {

	ROUTE('+API    /apiv1/        -apps_query             *Apps            --> query');
	ROUTE('+API    /apiv1/        -apps_read/id           *Apps            --> read');
	ROUTE('+API    /apiv1/        -apps_restart/id        *Apps            --> restart');
	ROUTE('+API    /apiv1/        -apps_restart_all       *Apps            --> restart_all');
	ROUTE('+API    /apiv1/        +apps_save              *Apps            --> check port save (response)', [50000]);
	ROUTE('+API    /apiv1/        -apps_remove/id         *Apps            --> remove');
	ROUTE('+API    /apiv1/        -apps_stop/id           *Apps            --> stop');
	ROUTE('+API    /apiv1/        -apps_stop_all          *Apps            --> stop_all');
	ROUTE('+API    /apiv1/        -apps_analyzator        *Apps            --> analyzator');
	ROUTE('+API    /apiv1/        -templates              *Templates       --> query');
	ROUTE('+API    /apiv1/        +templates_apply/id     *Templates       --> check stop backup remove unpack (response) restart', [50000]);
	ROUTE('+API    /apiv1/        -fixpermissions         *Operations      --> fixpermissions', [50000]);
	ROUTE('+API    /apiv1/        -settings_read          *Settings        --> read');
	ROUTE('+API    /apiv1/        +settings_save          *Settings        --> save');
	ROUTE('+API    /apiv1/        -updatetotal            *Operations      --> updatetotal');
	ROUTE('+API    /apiv1/        -filebrowser/id         *FileBrowser     --> query');
	ROUTE('+API    /apiv1/        -filebrowser_read/id    *FileBrowser     --> read');
	ROUTE('+API    /apiv1/        +filebrowser_save/id    *FileBrowser     --> save');
	ROUTE('+API    /apiv1/        -users_query            *Users           --> query');
	ROUTE('+API    /apiv1/        -users_read/id          *Users           --> read');
	ROUTE('+API    /apiv1/        -users_remove/id        *Users           --> remove');
	ROUTE('+API    /apiv1/        +users_insert           *Users           --> insert');
	ROUTE('+API    /apiv1/        +users_update/id        *Users           --> update');
	ROUTE('+API    /apiv1/        -account_read           *Account         --> read');
	ROUTE('+API    /apiv1/        +account_save           *Account         --> save');
	ROUTE('+API    /apiv1/        -alarms_query           *Alarms          --> query');
	ROUTE('+API    /apiv1/        +alarms_save            *Alarms          --> save');
	ROUTE('+API    /apiv1/        -alarms_remove/id       *Alarms          --> remove');
	ROUTE('+API    /apiv1/        -notifications_query    *Notifications   --> query');
	ROUTE('+API    /apiv1/        -notifications_clear    *Notifications   --> remove');
	ROUTE('-API    /apiv1/        +login                  *Account/Login   --> exec');
	ROUTE('+API    /apiv1/        -logout                 *Account         --> logout');
	ROUTE('+GET    /backup/                               *Operations      --> backup', [1200000]);
	ROUTE('GET     /logs/{id}/                            *Apps            --> logs');

	// Custom defined actions
	ROUTE('+GET    /download/{id}/',    download, [120000]);
	ROUTE('+POST   /api/upload/',       upload, ['upload', 120000], 1024 * 100); // Max. 100 MB
	ROUTE('+POST   /api/filebrowser/',  upload_filebrowser, ['upload'], 1024 * 100); // Max. 100 MB

	ROUTE('+SOCKET /', socket, ['json']);
};

function socket() {

	var self = this;

	MAIN.ws = self;
	self.autodestroy(() => MAIN.ws = null);

	self.on('open', function(client) {

		if (SuperAdmin.server)
			client.send(SuperAdmin.server);

		var output = {};

		output.TYPE = 'appsinfo';

		for (var i = 0; i < APPLICATIONS.length; i++) {
			var item = APPLICATIONS[i];
			if (!item.stopped && item.current) {
				item.current.id = item.id;
				item.current.is = true;
				item.current.analyzator = item.analyzatoroutput;
				output['app' + item.id] = item.current;
			}
		}

		client.send(output);
	});

}

function upload() {
	var self = this;
	var app = APPLICATIONS.findItem('id', self.query.id || '');
	if (app) {
		SuperAdmin.logger('upload: {0}', self, app);
		var file = self.files[0];
		var filename = Path.join(CONF.directory_www, app.url.superadmin_linker(app.path), app.id + '.zip');
		file.move(filename, self.done(filename));
	} else
		self.invalid('404');
}

function download(id) {

	var self = this;
	var app = APPLICATIONS.findItem('id', id);
	if (!app) {
		self.invalid('404');
		return;
	}

	var linker = app.url.superadmin_linker();
	var directory = Path.join(CONF.directory_www, linker);
	var backup = Path.join(directory, linker + '_backup.zip');

	SuperAdmin.logger('backup: {0}', self, app);

	Exec('zip -r {0} .??* * -x \\*.git\\* \\*tmp\\* \\*node_modules\\*'.format(linker + '_backup.zip'), { cwd: directory }, function(err) {
		if (err)
			self.invalid().push(err);
		else
			self.file('~' + backup, U.getName(backup));
	});
}

function upload_filebrowser() {

	var self = this;

	if (!self.files.length) {
		self.invalid('error-file');
		return;
	}

	$WORKFLOW('FileBrowser', 'upload', self.callback(), self);
}