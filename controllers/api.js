const Path = require('path');
const Spawn = require('child_process').spawn;
const Exec = require('child_process').exec;

exports.install = function() {

	ROUTE('+API    /api/        -templates              *Templates       --> query');
	ROUTE('+API    /api/        +templates_apply/id     *Templates       --> check stop backup remove unpack (response) restart', [50000]);
	ROUTE('+API    /api/        -fixpermissions         *Operations      --> fixpermissions', [50000]);
	ROUTE('+API    /api/        -settings_read          *Settings        --> read');
	ROUTE('+API    /api/        +settings_save          *Settings        --> save');
	ROUTE('+API    /api/        -updatetotal            *Operations      --> updatetotal');
	ROUTE('+API    /api/        -filebrowser/id         *FileBrowser     --> query');
	ROUTE('+API    /api/        -filebrowser_read/id    *FileBrowser     --> read');
	ROUTE('+API    /api/        +filebrowser_save/id    *FileBrowser     --> save');
	ROUTE('+API    /api/        -account_read           *Account         --> read');
	ROUTE('+API    /api/        +account_save           *Account         --> save');
	ROUTE('+API    /api/        -alarms_query           *Alarms          --> query');
	ROUTE('+API    /api/        +alarms_save            *Alarms          --> save');
	ROUTE('+API    /api/        -alarms_remove/id       *Alarms          --> remove');
	ROUTE('+API    /api/        -notifications_query    *Notifications   --> query');
	ROUTE('+API    /api/        -notifications_clear    *Notifications   --> remove');
	ROUTE('-API    /api/        +login                  *Account/Login   --> exec');
	ROUTE('+API    /api/        -logout                 *Account         --> logout');
	ROUTE('+GET    /backup/                             *Operations      --> backup', [1200000]);
	ROUTE('GET     /logs/{id}/                          *Apps            --> logs');

	ROUTE('+API    /api/        -build_read/id          *Apps/Build      --> read');
	ROUTE('+API    /api/        +build_save/id          *Apps/Build      --> save', 1024 * 10);

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

		client.terminals = {};

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

	self.on('close', function(client) {
		var keys = Object.keys(client.terminals);
		for (var i = 0; i < keys.length; i++)
			client.terminals[keys[i]].kill(9);
	});

	self.on('message', function(client, msg) {

		var child;

		if (client.user.sa) {

			if (msg.TYPE === 'terminal_open') {

				var id = 'spawn' + UID();

				child = Spawn('bash', [], { cwd: '/www/' });
				client.send({ TYPE: 'terminal_open', id: id });
				client.terminals[id] = child;

				child.stderr.on('data', function(chunk) {
					var msg = {};
					msg.TYPE = 'terminal_data';
					msg.iserror = true;
					msg.id = id;
					msg.body = chunk.toString('utf8').trim();
					client.send(msg);
				});

				child.stdout.on('data', function(chunk) {
					var msg = {};
					msg.TYPE = 'terminal_data';
					msg.id = id;
					msg.body = chunk.toString('utf8').trim();
					client.send(msg);
				});

				child.on('close', function() {
					delete client.terminals[id];
					client.send({ TYPE: 'terminal_close', id: id });
				});

			} else if (msg.TYPE === 'terminal_send') {

				child = client.terminals[msg.id];

				if (child) {
					client.send({ TYPE: 'terminal_data', id: msg.id, body: msg.body, send: true });
					child.stdin.write(msg.body + '\n');
				}

			} else if (msg.TYPE === 'terminal_close') {
				if (msg.id) {
					child = client.terminals[msg.id];
					if (child) {
						child.kill(9);
						delete client.terminals[msg.id];
					}
				}
			} else if (msg.TYPE === 'terminal_cancel') {
				child = client.terminals[msg.id];
				child && child.kill(0);
			}
		}
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

	Exec('zip -r {0} .??* * -x \\*.git\\* \\*.socket\\* \\*tmp\\* \\*node_modules\\*'.format(linker + '_backup.zip'), { cwd: directory }, function(err) {
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