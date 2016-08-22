global.APPLICATIONS = [];

const Fs = require('fs');
const Path = require('path');
const Exec = require('child_process').exec;
const Spawn = require('child_process').spawn;
const SuperAdmin = global.SuperAdmin = {};

const REG_EMPTY = /\s{2,}/g;
const REG_PID = /\d+\s/;
const REG_PROTOCOL = /^(http|https)\:\/\//gi;
const REG_APPDISKSIZE = /^[\d\.\,]+[\w]\s/;
const REG_FINDVERSION = /[0-9\.]+/;

SuperAdmin.server = {};

var user;
try {
	var tmp = Fs.readFileSync('/www/superadmin/user.guid', 'utf8').split('\n')[0].split(':');
	if(tmp.length === 3)
		user = {user: tmp[0], id: parseInt(tmp[1]), group: parseInt(tmp[2])};
} catch (err) {}

SuperAdmin.run_as_user = user || {user: 'root', id:0, group:0};

String.prototype.superadmin_url = function() {
	return this.replace(REG_PROTOCOL, '').replace(/\//g, '');
};

String.prototype.superadmin_nginxredirect = function() {
	return this.superadmin_redirect().replace(REG_PROTOCOL, '');
};

String.prototype.parseTerminal = function(skipLines) {
	var output = {};
	var lines = this.trim().split('\n');

	if (!skipLines)
		skipLines = 0;

	output.length = lines.length - skipLines;

	for (var i = skipLines; i < output.length; i++)
		output[i] = lines[i].split(' ').trim();

	return output;
};

String.prototype.superadmin_redirect = function() {
	var end = this.substring(8);
	var index = end.indexOf('/');
	if (index !== -1)
		end = end.substring(0, index);
	return this.substring(0, 8) + end;
};

String.prototype.superadmin_linker = function(path) {
	var url = this.replace(REG_PROTOCOL, '').replace(/\//g, '');
	var arr = url.split('.');
	arr.reverse();
	var tmp = arr[1];
	arr[1] = arr[0];
	arr[0] = tmp;
	return arr.join('-').replace('-', '_') + (path ? path.replace(/\//g, '--').replace(/--$/g, '') : '');
};

SuperAdmin.nginx = 0;

/**
 * Gets CPU/Memory, OpeneFiles and Network connections
 * @param {Number} pid
 * @param {Function(err, info)} callback
 */
SuperAdmin.appinfo = function(pid, callback) {

	var arr = [];
	var output = {};
	var app = APPLICATIONS.findItem('pid', pid);
	if (app) {
		if (app.appinfo === undefined)
			app.appinfo = 0;
		else
			app.appinfo++;
	}

	// Get basic information
	arr.push(function(next) {
		Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
			if (err)
				return next();
			var line = response.split('\n')[1];
			line = line.trim().replace(REG_EMPTY, ' ').split(' ');
			output.cpu = line[0] + ' %';
			output.memory = (line[1].parseInt() / 1024).format(2) + ' MB';
			output.time = line[2];
			next();
		});
	});

	// Get count of open files
	arr.push(function(next) {
		Exec('lsof -a -p {0} | wc -l'.format(pid), function(err, response) {
			if (err)
				return next();
		 	output.openfiles = response.trim().parseInt();
		 	next();
		});
	});

	// Get count of opened network connections
	arr.push(function(next) {

		if (!app)
			return next();

		Exec('netstat -an | grep :{0} | wc -l'.format(app.port), function(err, response) {
			if (err)
				return next();
		 	output.connections = response.trim().parseInt() - 1;
		 	if (output.connections < 0)
		 		output.connections = 0;
		 	next();
		});
	});

	// Get directory size
	arr.push(function(next) {

		if (!app || app.appinfo % 10 !== 0) {
			if (app)
				output.hdd = app.cache_hdd;
			return next();
		}

		Exec('du -hs {0}'.format(Path.join(CONFIG('directory-www'), app.linker)), function(err, response) {
			if (err)
				return next();
		 	var match = response.trim().match(REG_APPDISKSIZE);
		 	if (match) {
		 		output.hdd = match.toString().trim();
		 		app.cache_hdd = output.hdd;
		 	}
		 	next();
		});
	});

	arr.async(() => callback(null, output));
	return SuperAdmin;
};

SuperAdmin.sysinfo = function(callback) {

	var arr = [];

	if (SuperAdmin.server.index === undefined)
		SuperAdmin.server.index = 0;
	else
		SuperAdmin.server.index++;

	arr.push(function(next) {
		Exec('free -m', function(err, response) {
			if (err)
				return next();
			var memory = response.split('\n')[1].match(/\d+/g);
			SuperAdmin.server.memtotal = memory[0].parseInt();
			SuperAdmin.server.memfree = memory[2].parseInt();
			SuperAdmin.server.memused = memory[1].parseInt();
			next();
		});
	});

	arr.push(function(next) {
		Exec('df -hT {0}'.format(CONFIG('directory-www')), function(err, response) {
			if (err)
				return next();
			var info = response.parseTerminal();
			SuperAdmin.server.hddtotal = info[1][2].replace('G', ' GB');
			SuperAdmin.server.hddfree = info[1][4].replace('G', ' GB');
			SuperAdmin.server.hddused = info[1][3].replace('G', ' GB');
			next();
		});
	});

	arr.push(function(next) {
		Exec('netstat -anp | grep :80 | grep TIME_WAIT| wc -l', function(err, response) {
			if (err)
				return next();
			SuperAdmin.server.connections = response.trim().parseInt();
			next();
		});
	});

	arr.push(function(next) {
		Exec('bash {0}'.format(F.path.databases('cpu.sh')), function(err, response) {
			if (err)
				return next();
			SuperAdmin.server.cpu = response.trim().parseFloat().format(1) + '%';
			next();
		});
	});

	arr.push(function(next) {
		if (SuperAdmin.server.index % 3 !== 0)
			return next();
		Exec('ps aux | grep "mongod" | grep -v "grep" | awk {\'print $2\'}', function(err, response) {
			if (err)
				return next();
			var pid = response.trim();
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
				var line = response.split('\n')[1];
				line = line.trim().replace(REG_EMPTY, ' ').split(' ');
				SuperAdmin.server.mongodb = {};
				SuperAdmin.server.mongodb.cpu = line[0] + ' %';
				SuperAdmin.server.mongodb.memory = (line[1].parseInt() / 1024).format(0) + ' MB';
				SuperAdmin.server.mongodb.time = line[2];
				next();
			});
		});
	});

	arr.push(function(next) {
		if (SuperAdmin.server.index % 3 !== 0)
			return next();
		Exec('ps aux | grep "postgres" | grep -v "grep" | awk {\'print $2\'}', function(err, response) {
			if (err)
				return next();
			var pid = response.trim();
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid.split('\n').join(',')), function(err, response) {
				SuperAdmin.server.postgresql = {};
				SuperAdmin.server.postgresql.cpu = 0;
				SuperAdmin.server.postgresql.memory = 0;
				response.split('\n').forEach(function(line, index) {
					line = line.trim();
					if (!index || !line)
						return;
					line = line.replace(REG_EMPTY, ' ').split(' ');
					SuperAdmin.server.postgresql.cpu += line[0].parseFloat();
					SuperAdmin.server.postgresql.memory += (line[1].parseInt() / 1024);
				});
				SuperAdmin.server.postgresql.cpu = SuperAdmin.server.postgresql.cpu.format(1) + ' %';
				SuperAdmin.server.postgresql.memory = SuperAdmin.server.postgresql.memory.format(0) + ' MB';
				next();
			});
		});
	});

	arr.push(function(next) {
		if (SuperAdmin.server.index % 3 !== 0)
			return next();
		Exec('ps aux | grep "mysql" | grep -v "grep" | awk {\'print $2\'}', function(err, response) {
			if (err)
				return next();
			var pid = response.trim();
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
				var line = response.split('\n')[1];
				line = line.trim().replace(REG_EMPTY, ' ').split(' ');
				SuperAdmin.server.mysql = {};
				SuperAdmin.server.mysql.cpu = line[0] + ' %';
				SuperAdmin.server.mysql.memory = (line[1].parseInt() / 1024).format(0) + ' MB';
				SuperAdmin.server.mysql.time = line[2];
				next();
			});
		});
	});

	arr.push(function(next) {
		if (SuperAdmin.server.index % 3 !== 0)
			return next();
		Exec('ps aux | grep "redis" | grep -v "grep" | awk {\'print $2\'}', function(err, response) {
			if (err)
				return next();
			var pid = response.trim();
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
				var line = response.split('\n')[1];
				line = line.trim().replace(REG_EMPTY, ' ').split(' ');
				SuperAdmin.server.redis = {};
				SuperAdmin.server.redis.cpu = line[0] + ' %';
				SuperAdmin.server.redis.memory = (line[1].parseInt() / 1024).format(0) + ' MB';
				SuperAdmin.server.redis.time = line[2];
				next();
			});
		});
	});

	arr.async(() => callback(null, SuperAdmin.server));
};

/**
 * Gets PID by PORT number
 * @param {Number} port
 * @param {Function(err, pid)} callback
 */
SuperAdmin.pid = function(port, callback) {

	var item = APPLICATIONS.findItem('port', port);
	if (!item) {
		callback(null, 'error-app-404');
		return;
	}

	Exec('lsof -i :' + port + ' | grep "total"', function(err, response) {
		var pid = response.match(REG_PID);
		if (!pid)
			return callback(err);
		item.pid = pid.toString().trim();
		callback(null, item.pid);
	});

	return SuperAdmin;
};

/**
 * Runs application
 * @param {String} url
 * @param {Number} port
 * @param {Boolean} debug
 * @param {Function} callback
 */
SuperAdmin.run = function(port, callback) {

	var app = APPLICATIONS.findItem('port', port);
	if (!app) {
		callback(new Error('Application doesn\'t exist.'));
		return;
	}

	var filename = app.debug ? 'debug.js' : 'release.js';
	var linker = app.linker;
	var log = app.debug ? Path.join(CONFIG('directory-www'), linker, 'logs', 'debug.log') : Path.join(CONFIG('directory-console'), linker + '.log');

	var fn = function(callback) {
		SuperAdmin.makescripts(app, function() {
			if (!app.debug)
				return callback();
			// Creates log directory
			Exec('bash {0} {1}'.format(F.path.databases('mkdir.sh'), Path.join(CONFIG('directory-www'), linker, 'logs')), callback);
		});
	};

	app.pid = 0;

	F.unlink([log], function() {
		fn(function() {
			filename = Path.join(CONFIG('directory-www'), linker, filename);
			F.path.exists(filename, function(e) {
				if (!e)
					return;
				Spawn('node', ['--nouse-idle-notification', '--expose-gc', '--max_inlined_source_size=1200', filename, app.port], {
					stdio: ['ignore', Fs.openSync(log, 'a'), Fs.openSync(log, 'a')],
					cwd: Path.join(CONFIG('directory-www'), linker),
					detached: true,
					uid: SuperAdmin.run_as_user.id,
					gid: SuperAdmin.run_as_user.group
				}).unref();
				setTimeout(() => callback(), app.delay || 100);
			});
		});
	});

	return SuperAdmin;
};

SuperAdmin.restart = function(port, callback) {
	return SuperAdmin.kill(port, function() {
		SuperAdmin.run(port, callback);
	});
};

SuperAdmin.npminstall = function(app, callback) {
	Exec('bash {0} {1}'.format(F.path.databases('npminstall.sh'), Path.join(CONFIG('directory-www'), app.linker)), (err) => callback());
	return SuperAdmin;
};

/**
 * Kills application
 * @param {Number} port
 * @param {Function()} callback
 */
SuperAdmin.kill = function(port, callback) {
	return SuperAdmin.pid(port, function(err, pid) {
		if (pid)
			Exec('kill -9 ' + pid, () => callback(null, SUCCESS(true)));
		else
			callback(err);
	});
};

/**
 * Generates SSL
 * @param {String} url URL address without protocol
 * @param {Function(err)} callback
 */
SuperAdmin.ssl = function(url, generate, callback) {

	if (!generate)
		return callback();

	// Checks whether the SSL exists
	F.path.exists(Path.join(CONFIG('directory-ssl'), url, 'ca.cer'), function(e) {
		if (e)
			return callback();
		SuperAdmin.reload(function(err) {
			if (err)
				return callback(err);
			Exec('/root/.acme.sh/acme.sh --certhome {0} --issue -d {1} -w {2}'.format(CONFIG('directory-ssl'), url, CONFIG('directory-acme')), (err) => callback(err));
		});
	});
	return SuperAdmin;
};

SuperAdmin.versions = function(callback) {

	var arr = [];

	arr.push(function(next) {
		Exec('nginx -v', function(err, stdout, stderr) {
			var version = stderr.match(REG_FINDVERSION);

			if (!version) {
				callback();
				return;
			}

			SuperAdmin.server.version_nginx = version.toString();
			SuperAdmin.nginx = SuperAdmin.server.version_nginx.replace(/\./g, '').parseInt();
			next();
		});
	});

	arr.push(function(next) {
		Exec('lsb_release -a', function(err, stdout, stderr) {
			if (err)
				return next();
			var index = stdout.indexOf('Description:');
			if (index === -1)
				return next();

		 	SuperAdmin.server.version_server = stdout.substring(index + 12, stdout.indexOf('\n', index)).trim();
			next();
		});
	});

	arr.push(function(next) {
		Exec('node --version', function(err, stdout, stderr) {
			if (err)
				return next();
			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
		 		SuperAdmin.server.version_node = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('gm -version', function(err, stdout, stderr) {
			if (err)
				return next();
			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
		 		SuperAdmin.server.version_gm = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('psql --version', function(err, stdout, stderr) {
			if (err)
				return next();
			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_postgresql = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('mongod --version', function(err, stdout, stderr) {
			if (err)
				return next();
			var version = stdout.match(REG_FINDVERSION);
			if (version)
		 		SuperAdmin.server.version_mongodb = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('mysql -v', function(err, stdout, stderr) {
			if (err)
				return next();
			var version = stdout.match(REG_FINDVERSION);
			if (version)
		 		SuperAdmin.server.version_mysql = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('redis-server --version', function(err, stdout, stderr) {
			if (err)
				return next();
			var version = stdout.match(REG_FINDVERSION);
			if (version)
		 		SuperAdmin.server.version_redis = version.toString();
			next();
		});
	});

	arr.async(callback);
	return SuperAdmin;
};

/**
 * Get count of network connections
 * @param {Number} port
 * @param {Function(err, count)} callback
 * @return {SuperAdmin}
 */
SuperAdmin.connections = function(port, callback) {
	Exec(F.path.databases('network.sh {0}').format(port), function(err, response) {
		if (err)
			return callback(null, 0);
		callback(null, response.trim().parseInt());
	});
	return SuperAdmin;
};

SuperAdmin.backup = function(callback) {
	var filename = new Date().format('yyyyMMdd') + '-backup.tar.gz';
	Exec('bash {0} {1} {2}'.format(F.path.databases('backup.sh'), CONFIG('directory-dump'), filename), function(err, response) {
		callback(err, Path.join(CONFIG('directory-dump'), filename));
	});
};

/**
 * Reloads NGINX configuration
 * @param {Function(err)} callback
 */
SuperAdmin.reload = function(callback) {
	Exec('service nginx configtest', function(err, response) {
		if (err)
			return callback(response);
		Exec('service nginx reload', (err, response) => callback(err && response));
	});
	return SuperAdmin;
};

SuperAdmin.save = function(callback) {
	APPLICATIONS.quicksort('priority', false);
	Fs.writeFile(F.path.databases('applications.json'), JSON.stringify(APPLICATIONS), callback);
	return SuperAdmin;
};

SuperAdmin.load = function(callback) {
	Fs.readFile(F.path.databases('applications.json'), function(err, response) {
		if (response)
			APPLICATIONS = JSON.parse(response.toString('utf8'));

		// Resets PID
		APPLICATIONS.forEach(function(item) {
			item.pid = 0;
			item.linker = item.url.superadmin_linker(item.path);
			if (!item.priority)
				item.priority = 0;
			if (!item.delay)
				item.delay = 0;
		});

		// RUNS APPLICATIONS
		APPLICATIONS.quicksort('priority', false);
		callback && callback();
	});
	return SuperAdmin;
};

/**
 * Makes executables
 * @param {Application} app
 * @param {Function(err)} callback
 * @return {SuperAdmin}
 */
SuperAdmin.makescripts = function(app, callback) {
	var linker = app.linker;
	var directory = Path.join(CONFIG('directory-www'), linker);
	Exec('mkdir -p ' + directory, function() {
		Exec('chmod 777 {0}'.format(directory), function() {
			SuperAdmin.copy(F.path.databases('debug.js'), Path.join(directory, 'debug.js'), function(err) {
				SuperAdmin.copy(F.path.databases('release{0}.js'.format(app.cluster > 1 ? '-cluster' : '')), Path.join(directory, 'release.js'), function(err) {
					callback(err);
				}, (response) => response.toString('utf8').format(app.cluster));
			});
		});
	});
	return SuperAdmin;
};

SuperAdmin.copy = function(filename, target, callback, prepare) {
	Fs.readFile(filename, function(err, response) {
		if (err)
			return callback(err);
		Fs.writeFile(target, prepare ? prepare(response) : response, callback);
	});
	return SuperAdmin;
};

SuperAdmin.init = function() {
	SuperAdmin.load(function() {
		SuperAdmin.versions(function() {

			APPLICATIONS.wait(function(item, next) {

				if (item.stopped)
					return next();

				SuperAdmin.pid(item.port, function(err, pid) {
					if (pid)
						return next();
					SuperAdmin.run(item.port, () => next());
				});
			});

		});
	});
	return SuperAdmin;
};

SuperAdmin.init();
