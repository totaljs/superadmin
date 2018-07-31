global.APPLICATIONS = [];

const Url = require('url');
const Fs = require('fs');
const Path = require('path');
const Exec = require('child_process').exec;
const Spawn = require('child_process').spawn;
const SuperAdmin = global.SuperAdmin = {};

const REG_EMPTY = /\s{2,}/g;
const REG_PID = /\d+\s/;
const REG_PROTOCOL = /^(http|https):\/\//gi;
const REG_APPDISKSIZE = /^[\d.,]+/;
const REG_FINDVERSION = /[0-9.]+/;

SuperAdmin.server = {};
SuperAdmin.options = { nginxpath: 'nginx', acmepath: '/root/.acme.sh/acme.sh', acmethumbprint: '' };

var user;
try {
	var tmp = Fs.readFileSync('/www/superadmin/user.guid', 'utf8').split('\n')[0].split(':');
	if (tmp.length === 3)
		user = { user: tmp[0], id: parseInt(tmp[1]), group: parseInt(tmp[2]) };
} catch (err) {}

SuperAdmin.run_as_user = user || { user: 'root', id: 0, group: 0 };

String.prototype.superadmin_url = function() {
	return this.replace(REG_PROTOCOL, '').replace(/\//g, '');
};

String.prototype.superadmin_nginxredirect = function() {
	return this.superadmin_redirect().replace(REG_PROTOCOL, '');
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
SuperAdmin.appinfo = function(pid, callback, app) {

	var arr = [];
	app = app ? app : APPLICATIONS.findItem('pid', pid);
	if (!app)
		return callback(new Error('Application doesn\'t exists.'));

	if (!app.stats)
		app.stats = {};

	var current = app.current ? app.current : (app.current = {});

	if (current.interval)
		current.interval++;
	else
		current.interval = 1;

	current.cluster = app.cluster;
	current.port = app.port;
	current.pid = pid;

	// Get basic information
	arr.push(function(next) {
		Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
			if (err)
				return next();

			var line = response.split('\n')[1];
			line = line.trim().replace(REG_EMPTY, ' ').split(' ');
			var cpu = line[0].parseFloat();

			current.cpu = cpu.floor(1) + ' %';
			current.memory = line[1].parseInt2() * 1024; // kB to bytes
			current.time = line[2];

			app.stats.cpu = Math.max(app.stats.cpu || 0, cpu);
			app.stats.memory = Math.max(app.stats.memory || 0, current.memory);
			next();
		});
	});

	// Get count of open files
	arr.push(function(next) {
		Exec('lsof -a -p {0} | wc -l'.format(pid), function(err, response) {

			if (!err) {
				current.openfiles = response.trim().parseInt2();
				app.stats.openfiles = Math.max(app.stats.openfiles || 0, current.openfiles);
			}

			next();
		});
	});

	// Get count of opened network connections
	arr.push(function(next) {
		Exec('netstat -an | grep :{0} | wc -l'.format(app.port), function(err, response) {
			if (err)
				return next();

			current.connections = response.trim().parseInt2() - 1;

			if (current.connections < 0)
				current.connections = 0;

			app.stats.connections = Math.max(app.stats.connections || 0, current.connections);
			next();
		});
	});

	// Get directory size
	arr.push(function(next) {

		if (current.interval % 5 !== 0)
			return next();

		Exec('du -hsb {0}'.format(Path.join(CONFIG('directory-www'), app.linker)), function(err, response) {
			if (err)
				return next();
			var match = response.trim().match(REG_APPDISKSIZE);
			if (match) {
				current.hdd = match.toString().trim().parseInt2();
				app.stats.hdd = Math.max(app.stats.hdd || 0, current.hdd);
			}
			next();
		});
	});

	// Get SSL expiration
	arr.push(function(next) {
		if (current.interval % 5 !== 0) {
			if (!current.sslcheckforce)
				return next();
		}
		else if (!app.url.startsWith('https://')) {
			current.sslexpire = undefined;
			current.sslexpirerenew = undefined;
			return next();
		}

		var name = app.url.superadmin_url();
		current.sslcheckforce = false;

		Exec('cat {0} | openssl x509 -noout -enddate'.format(app.ssl_cer ? app.ssl_cer : Path.join(CONFIG('directory-ssl'), name, name + '.cer')), function(err, response) {

			if (err)
				return next();

			var index = response.indexOf('=');
			if (index !== -1) {
				current.sslexpire = new Date(Date.parse(response.substring(index + 1).trim()));
				current.sslexpirecan = app.ssl_cer ? false : current.sslexpire.diff('days') < 6;
				if (F.global.settings.autorenew && current.sslexpirecan && (!current.sslexpirerenew || current.sslexpirerenew < F.datetime)) {
					current.sslexpirerenew = F.datetime.add('1 day');
					var model = $MAKE('Application', app, undefined, undefined, undefined, true);
					model.$workflow('renew', function(err) {

						next();
						LOGGER('renew', app.url, current.sslexpire.format(), err);

						if (err)
							SuperAdmin.sendNotify(TRANSLATE('default', 'Problem with renew of SSL certificate <a href="{0}">{0}</a>. <b>Error:</b> {1}.'.format(app.url, err.plain())), 'fa-times-circle', '#CD1B28');
						else
							SuperAdmin.sendNotify(TRANSLATE('default', 'SSL certificate has been renewed successfully for <a href="{0}">{0}</a>.'.format(app.url)), 'fa-check-circle', '#8CC152');
					});
					return;
				}
			}

			next();
		});
	});

	arr.push(function(next) {
		SuperAdmin.notify(app, 1);
		next();
	});

	arr.async(() => callback(null, current));
	return SuperAdmin;
};

SuperAdmin.sysinfo = function(callback) {

	var arr = [];

	if (SuperAdmin.server.index === undefined)
		SuperAdmin.server.index = 0;
	else
		SuperAdmin.server.index++;

	arr.push(function(next) {
		Exec('free -b -t', function(err, response) {
			if (err)
				return next();
			var memory = response.split('\n')[1].match(/\d+/g);
			SuperAdmin.server.memtotal = memory[0].parseInt();
			SuperAdmin.server.memfree = memory[2].parseInt() + memory[4].parseInt();
			SuperAdmin.server.memused = memory[1].parseInt();
			next();
		});
	});

	arr.push(function(next) {
		Exec('df -hTB1 {0}'.format(CONFIG('directory-www')), function(err, response) {
			if (err)
				return next();
			response.parseTerminal(function(info) {
				SuperAdmin.server.hddtotal = info[2].parseInt();
				SuperAdmin.server.hddfree = info[4].parseInt();
				SuperAdmin.server.hddused = info[3].parseInt();
			}, 1);
			next();
		});
	});

	arr.push(function(next) {
		Exec('netstat -anp | grep :80 | grep TIME_WAIT| wc -l', function(err, response) {
			if (!err)
				SuperAdmin.server.networkconnections = response.trim().parseInt();
			next();
		});
	});

	arr.push(function(next) {
		Exec('ifconfig eth0', function(err, response) {
			var match = response.match(/RX bytes:\d+|TX bytes:\d+/g);
			if (match) {
				SuperAdmin.server.networkdownload = match[0].parseInt2();
				SuperAdmin.server.networkupload = match[1].parseInt2();
			}
			next();
		});
	});

	arr.push(function(next) {
		Exec('uptime -s', function(err, response) {
			SuperAdmin.server.uptime = response.replace(' ', 'T').parseDate().diff('seconds') * -1;
			next();
		});
	});

	arr.push(function(next) {
		Exec('bash {0}'.format(F.path.databases('cpu.sh')), function(err, response) {
			if (!err)
				SuperAdmin.server.cpu = response.trim().parseFloat().format(1) + '%';
			next();
		});
	});

	arr.push(function(next) {
		if (SuperAdmin.server.index % 3 !== 0)
			return next();
		Exec('ps aux | grep "nginx" | grep -v "grep" | awk {\'print $2\'}', function(err, response) {
			if (err)
				return next();

			var pid = response.trim().split('\n').join(',');
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
				var line = response.split('\n')[1];
				line = line.trim().replace(REG_EMPTY, ' ').split(' ');
				SuperAdmin.server.nginx = {};
				SuperAdmin.server.nginx.cpu = line[0] + ' %';
				SuperAdmin.server.nginx.memory = line[1].parseInt() * 1024; // kB to bytes
				next();
			});
		});
	});

	arr.push(function(next) {
		if (SuperAdmin.server.index % 3 !== 0)
			return next();
		Exec('ps aux | grep "mongod" | grep -v "grep" | awk {\'print $2\'}', function(err, response) {
			if (err)
				return next();
			var pid = response.trim().split('\n').join(',');
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
				var line = response.split('\n')[1];
				line = line.trim().replace(REG_EMPTY, ' ').split(' ');
				SuperAdmin.server.mongodb = {};
				SuperAdmin.server.mongodb.cpu = line[0] + ' %';
				SuperAdmin.server.mongodb.memory = line[1].parseInt() * 1024; // kB to bytes
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
			var pid = response.trim().split('\n').join(',');
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
					SuperAdmin.server.postgresql.memory += line[1].parseInt() * 1024; // kB to bytes
				});
				SuperAdmin.server.postgresql.cpu = SuperAdmin.server.postgresql.cpu.format(1) + ' %';
				SuperAdmin.server.postgresql.memory = SuperAdmin.server.postgresql.memory.floor(2);
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
			var pid = response.trim().split('\n').join(',');
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
				var line = response.split('\n')[1];
				line = line.trim().replace(REG_EMPTY, ' ').split(' ');
				SuperAdmin.server.mysql = {};
				SuperAdmin.server.mysql.cpu = line[0] + ' %';
				SuperAdmin.server.mysql.memory = line[1].parseInt() * 1024; // kb to bytes
				SuperAdmin.server.mysql.time = line[2];
				next();
			});
		});
	});

	arr.push(function(next) {
		if (SuperAdmin.server.index % 3 !== 0)
			return next();
		Exec('ps aux | grep "couchdb" | grep -v "grep" | awk {\'print $2\'}', function(err, response) {
			if (err)
				return next();
			var pid = response.trim().split('\n').join(',');
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
				SuperAdmin.server.couchdb = {};
				SuperAdmin.server.couchdb.cpu = 0;
				SuperAdmin.server.couchdb.memory = 0;
				response.split('\n').forEach(function(line, index) {
					line = line.trim();
					if (!index || !line)
						return;
					line = line.replace(REG_EMPTY, ' ').split(' ');
					SuperAdmin.server.couchdb.cpu += line[0].parseFloat();
					SuperAdmin.server.couchdb.memory += line[1].parseInt() * 1024; // kB to bytes
				});
				SuperAdmin.server.couchdb.cpu = SuperAdmin.server.couchdb.cpu.format(1) + ' %';
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
			var pid = response.trim().split('\n').join(',');
			if (!pid)
				return next();
			Exec('ps -p {0} -o %cpu,rss,etime'.format(pid), function(err, response) {
				var line = response.split('\n')[1];
				line = line.trim().replace(REG_EMPTY, ' ').split(' ');
				SuperAdmin.server.redis = {};
				SuperAdmin.server.redis.cpu = line[0] + ' %';
				SuperAdmin.server.redis.memory = line[1].parseInt() * 1024; // kB to bytes
				SuperAdmin.server.redis.time = line[2];
				next();
			});
		});
	});

	arr.async(function() {
		EMIT('superadmin.system', SuperAdmin.server);
		callback(null, SuperAdmin.server);
	});
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

	Exec('lsof -i :' + port + ' | grep \'total\'', function(err, response) {
		var pid = response.match(REG_PID);
		if (pid) {
			item.pid = pid.toString().trim();
			callback(null, item.pid, item);
		} else
			callback(err, null, item);
	});

	return SuperAdmin;
};

/**
 * Get PID (cached)
 * @param {Application} app
 * @param {Function(err, pid)} callback
 * @return {SuperAdmin}
 */
SuperAdmin.pid2 = function(app, callback) {
	if (app.pid && app.current && app.current.interval % 5 !== 0)
		callback(null, app.pid);
	else
		SuperAdmin.pid(app.port, callback);
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

	!app.debug && Exec('bash {0} {1} {2}'.format(F.path.databases('backuplogs.sh'), log, log.replace(/\.log$/, '-' + F.datetime.format('yyyyMMdd-HHmm.log'))), NOOP);

	// Reset output of analyzator
	app.analyzatoroutput = null;

	var fn = function(callback) {
		SuperAdmin.makescripts(app, function() {
			// Creates a log directory
			if (app.debug)
				Exec('bash {0} {1}'.format(F.path.databases('mkdir.sh'), Path.join(CONFIG('directory-www'), linker, 'logs')), callback);
			else
				callback();
		});
	};

	app.pid = 0;

	if (app.current)
		app.current = null;

	// Because of backuping logs
	setTimeout(function() {
		F.unlink([log], function() {
			fn(function() {
				filename = Path.join(CONFIG('directory-www'), linker, app.startscript || filename);
				F.path.exists(filename, function(e) {

					if (!e) {
						callback && callback(new Error('Start script doesn\'t exist ({0}).'.format(linker)));
						return;
					}

					// , '--max_inlined_source_size=1200'
					var options = ['--nouse-idle-notification', '--expose-gc'];

					app.memory && options.push('--max_old_space_size=' + app.memory);
					options.push(filename);
					options.push(app.port);

					Spawn('node', options, {
						stdio: ['ignore', Fs.openSync(log, 'a'), Fs.openSync(log, 'a')],
						cwd: Path.join(CONFIG('directory-www'), linker),
						detached: true,
						uid: SuperAdmin.run_as_user.id,
						gid: SuperAdmin.run_as_user.group
					}).unref();

					EMIT('superadmin.app.run', app);
					setTimeout(() => callback && callback(), app.delay || 100);
				});
			});
		});
	}, 500);

	return SuperAdmin;
};

SuperAdmin.restart = function(port, callback) {
	return SuperAdmin.kill(port, function() {
		SuperAdmin.run(port, callback);
	});
};

SuperAdmin.npminstall = function(app, callback) {
	var directory = Path.join(CONFIG('directory-www'), app.linker);
	F.path.exists(Path.join(directory, 'package.json'), function(e) {
		if (e)
			Exec('bash {0} {1}'.format(F.path.databases('npminstall.sh'), directory), (err) => callback(err));
		else
			callback();
	});
	return SuperAdmin;
};

/**
 * Kills application
 * @param {Number} port
 * @param {Function(err)} callback
 */
SuperAdmin.kill = function(port, callback) {
	return SuperAdmin.pid(port, function(err, pid, app) {
		if (pid) {
			EMIT('superadmin.app.kill', app);
			Exec('kill ' + pid, () => callback(null, SUCCESS(true)));
		} else
			callback(err);
	});
};

// Generates SSL
SuperAdmin.ssl = function(url, generate, cb, renew, second) {

	if (!generate)
		return cb();

	var callback = function(err, is) {

		if (!err) {
			var app = APPLICATIONS.findItem('url', 'https://' + url);
			app && (app.current) && (app.current.sslcheckforce = true);
		}

		cb(err, is);
	};

	// Checks whether the SSL exists
	SuperAdmin.sslexists(url, second, function(e1, e2) {

		var recreatesecond = second && !e2 && !renew ? true : false;

		if (e1 && !renew && !recreatesecond)
			return callback(null, e2 ? false : true);

		SuperAdmin.reload(function(err) {

			if (err)
				return callback(err, true);

			var fallback = function(callback, problem_second) {
				Exec(SuperAdmin.options.acmepath + ' --certhome {0} --{3} -d {1} -w {2} --stateless'.format(CONFIG('directory-ssl'), url, CONFIG('directory-acme'), renew ? 'renew --force' : 'issue --force'), (err) => callback(err, problem_second));
			};

			if (!second)
				return fallback(callback, false);

			Exec(SuperAdmin.options.acmepath + ' --certhome {0} --{3} -d {1} -d {4} -w {2} --stateless'.format(CONFIG('directory-ssl'), url, CONFIG('directory-acme'), renew ? 'renew --force' : 'issue --force', second), function(err) {
				if (err) {
					if (recreatesecond)
						callback(null, true);
					else
						fallback(callback, true);
				}	else
					callback(err, false);
			});
		});
	});

	return SuperAdmin;
};

SuperAdmin.sslexists = function(url, second, callback) {
	Fs.readFile(Path.join(CONFIG('directory-ssl'), url, 'fullchain.cer'), function(err) {

		if (err) {
			callback(false, false);
			return;
		}

		if (!second)
			return callback(true, false);

		Fs.readFile(Path.join(CONFIG('directory-ssl'), url, url + '.conf'), function(err, data) {
			if (err)
				callback(false, false);
			else {
				data = data.toString('utf8');
				callback(true, second && (data.indexOf('Le_Alt="{0}"'.format(second)) !== -1 || data.indexOf('Le_Alt=\'{0}\''.format(second)) !== -1));
			}
		});
	});
};

SuperAdmin.versions = function(callback) {

	var arr = [];

	arr.push(function(next) {
		Exec(SuperAdmin.options.nginxpath + ' -v', function(err, stdout, stderr) {
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
		Exec('lsb_release -a', function(err, stdout) {
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
		Exec('node --version', function(err, stdout) {
			if (err)
				return next();
			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_node = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('gm -version', function(err, stdout) {
			if (err)
				return next();
			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_gm = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('psql --version', function(err, stdout) {
			if (err)
				return next();
			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_postgresql = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('mongod --version', function(err, stdout) {
			if (err)
				return next();
			var version = stdout.match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_mongodb = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('mysql -v', function(err, stdout) {
			if (err)
				return next();
			var version = stdout.match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_mysql = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('couchdb -V', function(err, stdout) {
			if (err)
				return next();
			var version = stdout.match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_couchdb = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		Exec('redis-server --version', function(err, stdout) {
			if (err)
				return next();
			var version = stdout.match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_redis = version.toString();
			next();
		});
	});

	arr.async(function() {
		EMIT('superadmin.system', SuperAdmin.server);
		callback();
	});

	return SuperAdmin;
};

SuperAdmin.backup = function(callback) {
	var filename = F.datetime.format('yyyyMMdd') + '-backup.tar.gz';
	Exec('bash {0} {1} {2}'.format(F.path.databases('backup.sh'), CONFIG('directory-dump'), filename), function(err) {
		callback(err, Path.join(CONFIG('directory-dump'), filename));
	});
};

SuperAdmin.backupapp = function(app, callback) {
	if (!F.global.settings.allowbackup || !app.backup)
		return callback(new Error('Backup is not allowed.'));
	var filename = Path.join(F.config['directory-dump'], F.datetime.format('yyyyMMddHHmmss') + '_' + app.linker + '-backup.tar.gz');
	Exec('bash {0} {1} {2}'.format(F.path.databases('backup.sh'), F.config['directory-www'] + app.linker + '/', filename), function(err) {
		SuperAdmin.ftp(filename, function() {
			SuperAdmin.logger('backuped: ' + filename, null, app);
			EMIT('superadmin.app.backup', app, filename);
			callback && callback(err, filename);
		});
	});
};

SuperAdmin.ftp = function(filename, callback) {

	var ftp = Url.parse(F.global.settings.ftp);
	var auth = ftp.auth.split(':');
	var username = auth[0];
	var password = auth[1];
	var target = U.getName(filename);

	Exec('bash {0} {1} {2} {3} {4} {5}'.format(F.path.databases('ftp.sh'), ftp.hostname, username, password, filename, target), function(err) {
		Fs.unlink(filename, NOOP);
		callback && callback(err);
	});
};

/**
 * Reloads NGINX configuration
 * @param {Function(err)} callback
 */
SuperAdmin.reload = function(callback) {
	Exec(SuperAdmin.options.nginxpath + ' -t', function(err) {
		if (err)
			callback(err.toString());
		else
			Exec(SuperAdmin.options.nginxpath + ' -s reload', (err, response) => callback(err && response));
	});
	return SuperAdmin;
};

SuperAdmin.save = function(callback, stats) {
	APPLICATIONS.quicksort('priority', false);
	var content = JSON.stringify(APPLICATIONS);
	Fs.writeFile(F.path.databases('applications.json'), content, callback || NOOP);
	stats && Fs.appendFile(F.path.databases('applications.backup'), F.datetime.format('yyyy-MM-dd HH:mm') + ' | ' + content + '\n', callback || NOOP);
	return SuperAdmin;
};

SuperAdmin.savestats = function(callback) {

	var db = NOSQL('stats');
	var updated = db.meta('updated');

	if (updated === undefined) {
		db.meta('updated', F.datetime);
		callback && callback(null, false);
		return SuperAdmin;
	}

	if (updated.getDate() === F.datetime.getDate()) {
		callback && callback(null, false);
		return SuperAdmin;
	}

	var builder = [];

	for (var i = 0, length = APPLICATIONS.length; i < length; i++) {
		var item = APPLICATIONS[i];

		if (!item.stats || !item.current)
			continue;

		item.current.interval = 0;

		var stats = U.clone(item.stats);
		stats.id = stats.id;
		stats.url = item.url;
		stats.datecreated = F.datetime;
		db.insert(stats);
		builder.push(stats);

		item.stats = {};
	}

	if (builder.length && F.global.settings.emailsummarization.length) {
		builder.date = F.datetime.add('-1 day');
		var msg = F.mail(F.global.settings.emailsummarization[0], F.config.name + ': @(Daily summarization) - ' + builder.date.format('dd. MMMM yyyy'), 'mails/summarization', builder, '');
		for (var i = 1, length = F.global.settings.emailsummarization.length; i < length; i++)
			msg.to(F.global.settings.emailsummarization[i]);
	}

	db.meta('updated', F.datetime);
	callback && callback(null, true);
	return SuperAdmin;
};

SuperAdmin.load = function(callback) {
	Exec('which nginx', function(err, response) {

		if (response) {
			response = response.trim();
			response && (SuperAdmin.options.nginxpath = response);
		}

		Fs.readFile(F.path.databases('applications.json'), function(err, response) {

			response && (APPLICATIONS = response.toString('utf8').parseJSON(true));

			// Resets PID
			APPLICATIONS.forEach(function(item) {
				item.pid = 0;
				item.linker = item.url.superadmin_linker(item.path);
				!item.priority && (item.priority = 0);
				!item.delay && (item.delay = 0);
				!item.analyzatoroutput && (item.analyzatoroutput = null);
			});

			// RUNS APPLICATIONS
			APPLICATIONS.quicksort('priority', false);
			callback && callback();
		});
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
			SuperAdmin.copy(F.path.databases('debug.js'), Path.join(directory, 'debug.js'), function() {
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
			callback(err);
		else
			Fs.writeFile(target, prepare ? prepare(response) : response, callback || NOOP);
	});
	return SuperAdmin;
};

// ACME stateless mode
SuperAdmin.acmethumbprint = function(callback) {
	var filename = F.path.databases('acmethumbprint.txt');
	Fs.readFile(filename, function(err, data) {

		if (data) {
			SuperAdmin.options.acmethumbprint = data.toString('utf8');
			if (SuperAdmin.options.acmethumbprint) {
				callback();
				return;
			}
		}

		Exec(SuperAdmin.options.acmepath + ' --register-account', function(err, response) {
			var index = response.indexOf('ACCOUNT_THUMBPRINT=');
			SuperAdmin.options.acmethumbprint = response.substring(index + 20, response.indexOf('\'', index + 21));
			Fs.writeFile(filename, SuperAdmin.options.acmethumbprint, NOOP);
			callback();
		});
	});

	return SuperAdmin;
};

SuperAdmin.init = function() {
	$GET('Settings', function() {
		EMIT('settings');
		SuperAdmin.acmethumbprint(function() {
			SuperAdmin.load(function() {
				SuperAdmin.versions(function() {
					APPLICATIONS.wait(function(item, next) {

						if (item.stopped)
							return next();

						SuperAdmin.pid(item.port, function(err, pid) {
							if (pid)
								next();
							else
								SuperAdmin.run(item.port, () => next());
						});
					});
				});
			});
		});
	});

	SuperAdmin.logger('init: SuperAdmin');
	return SuperAdmin;
};

SuperAdmin.logger = function(message, controller, id) {

	var app;

	if (id) {

		// id == App
		if (typeof(id.id) === 'string')
			app = id;
		else
			app = APPLICATIONS.findItem('id', id);

		if (app)
			message = message.format('"' + app.url + '"' + ' --> #' + app.id);
		else
			return SuperAdmin;

	}

	message && F.logger('logger', controller && controller.user ? ('[' + controller.user.name + ']') : '[nobody]', message, controller ? controller.ip : 'root');
	return SuperAdmin;
};

SuperAdmin.notify = function(app, type, callback) {

	// type = 0    - application has been offline, restarting...
	// type = 1    - application info read from system (app.current)
	// type = 2    - application monitoring (app.currentmonitor)
	// type = 3    - analyzator

	if (!F.global.RULES || !F.global.RULES.length) {
		callback && callback();
		return;
	}

	var skip = {};

	F.global.RULES.wait(function(item, next) {

		var key = 'delay' + (item.each ? app.id + item.id : item.id);
		if ((item.idapplication && item.idapplication !== app.id) || skip[key] || item[key] > F.datetime || (!item.debug && app.debug))
			return next();

		if (!app.current)
			app.current = {};

		if (!app.stats)
			app.stats = {};

		item.validate(app, function(err, response) {

			if (response === true) {

				skip[key] = true;

				// Magic for delay (sorry :-D)
				item[key] = F.datetime.add(item.delay);

				var message = item.format(item.message, app);

				NOSQL('alarms').counter.hit(item.id);
				LOGGER('alarms', item.name, message);
				EMIT('superadmin.app.alarm', app, item, message);

				if (app.stats)
					app.stats.alarms++;
				else
					app.stats.alarms = 1;

				item.phone && item.phone.length && SuperAdmin.sendSMS(item.phone, message.removeTags());
				item.email && item.email.length && SuperAdmin.sendEmail(item.email, message, item.name);
			}

			next();
		});
	}, callback);

};

SuperAdmin.sendSMS = function(numbers, message) {

	if (!F.global.settings.nexmokey || !F.global.settings.nexmosecret || !F.global.settings.nexmosender)
		return false;

	for (var i = 0, length = numbers.length; i < length; i++)
		RESTBuilder.make(function(builder) {
			builder.url('https://rest.nexmo.com/sms/json?api_key={0}&api_secret={1}&from={2}&to={3}&text={4}&type=unicode'.format(F.global.settings.nexmokey, F.global.settings.nexmosecret, encodeURIComponent(F.global.settings.nexmosender), numbers[i], encodeURIComponent(message)));
			builder.exec((err, response) => LOGGER('sms', 'response:', JSON.stringify(response), 'error:', err));
		});

	return true;
};

SuperAdmin.sendEmail = function(addresses, message, name) {
	var message = F.logmail(addresses[0], name, message);
	for (var i = 1, length = addresses.length; i < length; i++)
		message.to(addresses[i]);
};

SuperAdmin.sendNotify = function(message, icon, color) {
	NOSQL('notifications').insert({ body: message, datecreated: F.datetime, icon: icon, color: color });
};

SuperAdmin.init();
