global.APPLICATIONS = [];

const Url = require('url');
const Fs = require('fs');
const Path = require('path');
const Spawn = require('child_process').spawn;
const SuperAdmin = global.SuperAdmin = {};

const REG_EMPTY = /\s{2,}/g;
const REG_PID = /\d+\s/;
const REG_APPDISKSIZE = /^[\d.,]+/;
const REG_FINDVERSION = /[0-9.]+/;

if (!CONF.cdn)
	CONF.cdn = '//cdn.componentator.com';

SuperAdmin.server = { version_superadmin: 9, cpu: 0, cpucores: [] };
SuperAdmin.options = { nginxpath: 'nginx', acmepath: '/root/.acme.sh/acme.sh', acmethumbprint: '' };

SuperAdmin.wsnotify = function(type, app, msg) {

	var data = {};
	data.TYPE = type;

	if (msg)
		data.msg = msg;

	if (app) {
		data.id = app.id;
		data.url = app.url;
	}

	MAIN.ws && MAIN.ws.send(data);
};

var user;
try {
	var tmp = Fs.readFileSync('/www/superadmin/user.guid', 'utf8').split('\n')[0].split(':');
	if (tmp.length === 3)
		user = { user: tmp[0], id: parseInt(tmp[1]), group: parseInt(tmp[2]) };
} catch (err) {}

SuperAdmin.run_as_user = user || { user: 'root', id: 0, group: 0 };
SuperAdmin.nginx = 0;

/**
 * Gets CPU/Memory, OpenFiles and Network connections
 * @param {Number} pid
 * @param {Function(err, info)} callback
 */
SuperAdmin.appinfo = function(pid, callback, app) {

	var arr = [];
	app = app ? app : APPLICATIONS.findItem('pid', pid);

	if (!app) {
		callback('404');
		return;
	}

	if (!app.stats)
		app.stats = {};

	var current = app.current ? app.current : (app.current = {});

	if (current.interval)
		current.interval++;
	else
		current.interval = 0;

	current.cluster = app.cluster;
	current.port = app.port;
	current.pid = pid;
	current.is = true;

	if (app.debug || app.watcher) {
		arr.push(function(next) {
			SHELL('pgrep -P ' + pid, function(err, response) {
				if (err)
					current.pidchild = 0;
				else
					current.pidchild = response.trim().parseInt2();
				next();
			});
		});
	}

	// Get count of open files
	arr.push(function(next) {
		SHELL('ls /proc/{0}/fd/ | wc -l'.format(current.pidchild || pid), function(err, response) {

			if (!err) {
				current.openfiles = response.trim().parseInt2();
				app.stats.openfiles = Math.max(app.stats.openfiles || 0, current.openfiles);
			}

			next();
		});
	});

	// Get basic information
	arr.push(function(next) {
		SHELL('ps -p {0} -o %cpu,rss,etime'.format(current.pidchild || pid), function(err, response) {

			if (err) {
				next();
				return;
			}

			var line = response.split('\n')[1];
			line = line.trim().replace(REG_EMPTY, ' ').split(' ');
			var cpu = line[0].parseFloat();

			current.cpu = cpu.floor(1);
			current.memory = line[1].parseInt2() * 1024; // kB to bytes
			current.time = line[2];

			app.stats.cpu = Math.max(app.stats.cpu || 0, cpu);
			app.stats.memory = Math.max(app.stats.memory || 0, current.memory);
			next();
		});
	});


	// Get count of opened network connections
	if (app.unixsocket) {
		// Currently I don't know how to obtain a count of connections for unix-socket
		current.connections = 0;
	} else {
		arr.push(function(next) {
			SHELL('netstat -an | grep :{0} | wc -l'.format(app.port), function(err, response) {

				if (err) {
					next();
					return;
				}

				current.connections = response.trim().parseInt2() - 1;

				if (current.connections < 0)
					current.connections = 0;

				app.stats.connections = Math.max(app.stats.connections || 0, current.connections);
				next();

			});
		});
	}

	// Get directory size
	arr.push(function(next) {

		if (current.interval % 5 !== 0) {
			next();
			return;
		}

		SHELL('du -hsb {0}'.format(Path.join(CONF.directory_www, app.linker)), function(err, response) {

			if (err) {
				next();
				return;
			}

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

		if (app.subprocess) {
			next();
			return;
		}

		if (current.interval % 5 !== 0) {
			if (!current.sslcheckforce) {
				next();
				return;
			}
		} else if (!app.url.startsWith('https://')) {
			current.sslexpire = undefined;
			current.sslexpirerenew = undefined;
			next();
			return;
		}

		var name = app.url.superadmin_url();
		current.sslcheckforce = false;

		SHELL('cat {0} | openssl x509 -noout -enddate'.format(app.ssl_cer ? app.ssl_cer : Path.join(CONF.directory_ssl, name, name + '.cer')), function(err, response) {

			if (err) {
				next();
				return;
			}

			var index = response.indexOf('=');
			if (index === -1) {
				next();
				return;
			}

			current.sslexpire = new Date(Date.parse(response.substring(index + 1).trim()));
			current.sslexpirecan = app.ssl_cer ? false : current.sslexpire.diff('days') < 6;

			if (current.sslexpirecan && (!current.sslexpirerenew || current.sslexpirerenew < NOW)) {
				current.sslexpirerenew = NOW.add('1 day');
				TASK('nginx/init', function(err) {
					if (err)
						NOSQL('logs').insert({ type: 'error', url: app.url, body: 'Problem with renew of SSL certificate {0}. <b>Error:</b> {1}.'.format(app.url, err.toString()), datecreated: NOW });
					else {
						SuperAdmin.wsnotify('app_renew', app);
						NOSQL('logs').insert({ type: 'success', url: app.url, body: 'SSL certificate has been renewed successfully for {0}'.format(app.url), datecreated: NOW });
					}
					next();
				}).value = app.id;
				return;
			} else
				next();
		});
	});

	arr.push(function(next) {

		var filename = Path.join(CONF.directory_www, app.linker, 'restart');
		Fs.lstat(filename, function(err) {

			if (err) {
				next();
				return;
			}

			// Restart
			Fs.unlink(filename, NOOP);
			CALL('Apps --> restart').params({ id: app.id }).callback(next);
		});

	});

	arr.async(function() {

		current.analyzator = app.analyzatoroutput || '';
		callback && setTimeout(callback, 500, null, current);

		if (MAIN.ws) {
			current.id = app.id;
			current.TYPE = 'appinfo';
			MAIN.ws.send(current);
		}

	});
	return SuperAdmin;
};

SuperAdmin.sysinfo = function(callback) {

	var arr = [];

	if (SuperAdmin.server.index === undefined) {
		SuperAdmin.server.index = 0;
		SuperAdmin.server.TYPE = 'sysinfo';
	} else
		SuperAdmin.server.index++;

	arr.push(function(next) {

		if (SuperAdmin.server.index % 6 !== 0) {
			next();
			return;
		}

		SHELL('free -b -t', function(err, response) {

			if (err) {
				next();
				return;
			}

			var memory = response.split('\n')[1].match(/\d+/g);
			SuperAdmin.server.memtotal = memory[0].parseInt();
			SuperAdmin.server.memfree = memory[2].parseInt() + memory[4].parseInt();
			SuperAdmin.server.memused = memory[1].parseInt();
			next();
		});
	});

	arr.push(function(next) {

		if (SuperAdmin.server.index % 6 !== 0) {
			next();
			return;
		}

		SHELL('df -hTB1 {0}'.format(CONF.directory_www), function(err, response) {

			if (err) {
				next();
				return;
			}

			response.parseTerminal(function(info) {
				SuperAdmin.server.hddtotal = info[2].parseInt();
				SuperAdmin.server.hddfree = info[4].parseInt();
				SuperAdmin.server.hddused = info[3].parseInt();
			}, 1);

			next();
		});
	});

	arr.push(function(next) {
		SHELL('ps aux | wc -l', function(err, response) {
			SuperAdmin.server.processes = +response.trim();
			next();
		});
	});

	arr.push(function(next) {

		if (SuperAdmin.server.index % 20 !== 0) {
			next();
			return;
		}

		SHELL('uptime -s', function(err, response) {
			SuperAdmin.server.uptime = response.replace(' ', 'T').parseDate().diff('seconds') * -1;
			next();
		});

	});

	arr.push(function(next) {

		if (SuperAdmin.server.ip && SuperAdmin.server.index % 20 !== 0) {
			next();
			return;
		}

		SHELL('curl ifconfig.me', function(err, response) {
			SuperAdmin.server.ip = response && response.indexOf('<') === -1 ? response : '';
			next();
		});

	});

	arr.async(function() {

		SuperAdmin.server.superadmin = process.memoryUsage().heapUsed;
		EMIT('superadmin_sysinfo', SuperAdmin.server);
		callback && callback(null, SuperAdmin.server);
		MAIN.ws && MAIN.ws.send(SuperAdmin.server);
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
		callback(null, '404');
		return;
	}

	if (item.version === 'npmstart' || !item.version) {
		SHELL('lsof -i :' + port + ' | grep \'LISTEN\'', function(err, response) {
			var pid = response.match(REG_PID);
			if (pid) {
				item.pid = pid.toString().trim();
				callback(null, item.pid, item);
			} else
				callback(err, null, item);
		});
	} else {
		var pidfilename = Path.join(CONF.directory_www, item.linker, 'superadmin.pid');
		Fs.readFile(pidfilename, function(err, buffer) {
			if (buffer) {
				var pid = buffer.toString('ascii');
				item.pid = pid;
				SHELL('ps -p ' + pid, err => callback(err, err ? null : pid, item));
			} else
				callback('500', null, item);
		});
	}
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
		callback('404');
		return;
	}

	var filename = 'index.js';
	var linker = app.linker;
	var log = Path.join(CONF.directory_www, linker, 'logs', 'debug.log');

	!app.debug && SHELL('bash {0} {1} {2}'.format(PATH.private('backuplogs.sh'), log, Path.join(CONF.directory_console, linker + NOW.format('yyyyMMdd-HHmm') + '.log')), NOOP);

	// Reset output of analyzator
	app.analyzatoroutput = null;

	var fn = function(callback) {
		SuperAdmin.makescripts(app, function() {
			// Creates a log directory
			SHELL('bash {0} {1}'.format(PATH.private('mkdir.sh'), Path.join(CONF.directory_www, linker, 'logs')), callback);
		});
	};

	app.pid = 0;

	if (app.current)
		app.current = null;

	// Because of backuping logs
	setTimeout(function() {
		PATH.unlink([log, Path.join(CONF.directory_www, app.linker, 'superadmin.socket')], function() {
			fn(function() {

				filename = Path.join(CONF.directory_www, linker, app.startscript || filename);
				PATH.exists(filename, function(e) {

					if (!e) {
						callback && callback(new Error('Start script doesn\'t exist ({0}).'.format(linker)));
						return;
					}

					var options = [];
					var npmstart = app.version === 'npmstart';

					if (!npmstart) {
						options.push('--nouse-idle-notification', '--expose-gc');
						app.memory && options.push('--max_old_space_size=' + app.memory);
						options.push(filename);
					}

					if (npmstart || !CONF.unixsocket || !app.unixsocket)
						options.push(app.port);

					options.push(app.debug ? '--debug' : '--release');

					if (!app.debug && app.watcher)
						options.push('--watcher');

					if (npmstart) {
						options.unshift('--');
						options.unshift('start');
					}

					var run = function() {

						var p = Spawn(npmstart ? 'npm' : 'node', options, {
							stdio: ['ignore', Fs.openSync(log, 'a'), Fs.openSync(log, 'a')],
							cwd: Path.join(CONF.directory_www, linker),
							detached: true,
							uid: SuperAdmin.run_as_user.id,
							gid: SuperAdmin.run_as_user.group
						});

						Fs.writeFile(Path.join(CONF.directory_www, linker, 'superadmin.pid'), p.pid + '', NOOP);
						p.unref();

						EMIT('superadmin_app_run', app);
						callback && setTimeout(callback, app.delay || 1000);
					};

					if (npmstart)
						makenpmstart(app, run);
					else
						run();
				});
			});
		});
	}, 500);

	return SuperAdmin;
};

function makenpmstart(app, callback) {

	var directory = Path.join(CONF.directory_www, app.linker);
	var ops = [];
	var opt = {};

	// Check package.json
	ops.push(function(next) {
		var filename = Path.join(directory, 'package.json');
		Fs.lstat(filename, function(err, stats) {
			if (stats) {
				opt.package = true;
				next();
			} else {
				// Create
				Fs.writeFile(filename, JSON.stringify({ name: 'App', main: 'index.js', version: '1.0.0', dependencies: { total4: 'latest' }, scripts: { start: 'node index.js' }}), next);
			}
		});

	});

	// Check node_modules
	ops.push(function(next) {
		SuperAdmin.npminstall(app, next);
	});

	// done
	ops.async(callback);

}

SuperAdmin.restart = function(port, callback) {
	return SuperAdmin.kill(port, function() {
		SuperAdmin.run(port, callback);
	});
};

SuperAdmin.npminstall = function(app, callback) {
	var directory = Path.join(CONF.directory_www, app.linker);
	F.path.exists(Path.join(directory, 'package.json'), function(e) {
		if (e)
			SHELL('bash {0} {1}'.format(PATH.private('npminstall.sh'), directory), (err) => callback(err));
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
			EMIT('superadmin_app_kill', app);
			SHELL('kill ' + pid, function() {
				setTimeout(function() {
					SHELL('kill -9 ' + pid, () => callback(null, SUCCESS(true)));
				}, 1000);
			});
		} else
			callback(err);
	});
};

// Generates SSL
SuperAdmin.ssl = function(url, generate, cb, renew, second) {

	if (!generate) {
		cb();
		return;
	}

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

		if (e1 && !renew && !recreatesecond) {
			callback(null, e2 ? false : true);
			return;
		}

		SuperAdmin.reload(function(err) {

			if (err) {
				callback(err, true);
				return;
			}

			var fallback = function(callback, problem_second) {
				SHELL(SuperAdmin.options.acmepath + ' --certhome {0} --{3} -d {1} -w {2} --stateless'.format(CONF.directory_ssl, url, CONF.directory_acme, renew ? 'renew --force' : 'issue --force'), (err) => callback(err, problem_second));
			};

			if (!second) {
				fallback(callback, false);
				return;
			}

			SHELL(SuperAdmin.options.acmepath + ' --certhome {0} --{3} -d {1} -d {4} -w {2} --stateless'.format(CONF.directory_ssl, url, CONF.directory_acme, renew ? 'renew --force' : 'issue --force', second), function(err) {
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
	Fs.readFile(Path.join(CONF.directory_ssl, url, 'fullchain.cer'), function(err) {

		if (err) {
			callback(false, false);
			return;
		}

		if (!second) {
			callback(true, false);
			return;
		}

		Fs.readFile(Path.join(CONF.directory_ssl, url, url + '.conf'), function(err, data) {
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
		SHELL(SuperAdmin.options.nginxpath + ' -v', function(err, stdout, stderr) {
			var version = stderr.match(REG_FINDVERSION);

			if (!version) {
				callback();
				return;
			}

			SuperAdmin.server.version_nginx = version.toString();

			var v = SuperAdmin.server.version_nginx.split('.');
			var number = [];

			for (var i = 0; i < v.length; i++) {
				var n = v[i].padLeft(2, '0');
				number.push(n);
			}

			SuperAdmin.nginx = (number.join('').replace(/\./g, '') + 1).parseInt();
			next();
		});
	});

	arr.push(function(next) {
		SHELL('lsb_release -a', function(err, stdout) {

			if (err) {
				next();
				return;
			}

			var index = stdout.indexOf('Description:');
			if (index === -1) {
				next();
				return;
			}

			SuperAdmin.server.version_server = stdout.substring(index + 12, stdout.indexOf('\n', index)).trim();
			next();
		});
	});

	arr.push(function(next) {
		SHELL('node --version', function(err, stdout) {

			if (err) {
				next();
				return;
			}

			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_node = version.toString();

			next();
		});
	});

	arr.push(function(next) {
		SHELL('gm -version', function(err, stdout) {

			if (err) {
				next();
				return;
			}

			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_gm = version.toString();

			next();
		});
	});

	/*
	arr.push(function(next) {
		SHELL('psql --version', function(err, stdout) {

			if (err) {
				next();
				return;
			}

			var version = stdout.trim().match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_postgresql = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		SHELL('mongod --version', function(err, stdout) {
			if (err)
				return next();
			var version = stdout.match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_mongodb = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		SHELL('mysql -v', function(err, stdout) {

			if (err) {
				next();
				return;
			}

			var version = stdout.match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_mysql = version.toString();
			next();
		});
	});

	arr.push(function(next) {
		SHELL('couchdb -V', function(err, stdout) {

			if (err) {
				next();
				return;
			}

			var version = stdout.match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_couchdb = version.toString();

			next();
		});
	});

	arr.push(function(next) {
		SHELL('redis-server --version', function(err, stdout) {

			if (err) {
				next();
				return;
			}

			var version = stdout.match(REG_FINDVERSION);
			if (version)
				SuperAdmin.server.version_redis = version.toString();

			next();
		});
	});*/

	arr.async(function() {
		EMIT('superadmin.system', SuperAdmin.server);
		callback();
	});

	return SuperAdmin;
};

SuperAdmin.backup = function(callback) {
	var filename = NOW.format('yyyyMMdd') + '-backup.tar.gz';
	SHELL('bash {0} {1} {2}'.format(PATH.private('backup.sh'), CONF.directory_dump, filename), function(err) {
		callback(err, Path.join(CONF.directory_dump, filename));
	});
};

SuperAdmin.backupapp = function(app, callback) {

	if (!CONF.allowbackup || !app.backup) {
		callback(new Error('Backup is not allowed'));
		return;
	}

	var filename = Path.join(CONF.directory_dump, NOW.format('yyyyMMddHHmmss') + '_' + app.linker + '-backup.tar.gz');
	SHELL('bash {0} {1} {2}'.format(PATH.private('backup.sh'), CONF.directory_www + app.linker + '/', filename), function(err) {
		SuperAdmin.ftp(filename, function() {
			SuperAdmin.logger('backuped: ' + filename, null, app);
			EMIT('superadmin_app_backup', app, filename);
			callback && callback(err, filename);
		});
	});
};

SuperAdmin.ftp = function(filename, callback) {

	var ftp = Url.parse(CONF.ftp);
	var auth = ftp.auth.split(':');
	var username = auth[0];
	var password = auth[1];
	var target = U.getName(filename);

	SHELL('bash {0} {1} {2} {3} {4} {5}'.format(PATH.private('ftp.sh'), ftp.hostname, username, password, filename, target), function(err) {
		Fs.unlink(filename, NOOP);
		callback && callback(err);
	});
};

/**
 * Reloads NGINX configuration
 * @param {Function(err)} callback
 */
SuperAdmin.reload = function(callback) {
	SHELL(SuperAdmin.options.nginxpath + ' -t', function(err) {
		if (err)
			callback(err.toString());
		else
			SHELL(SuperAdmin.options.nginxpath + ' -s reload', (err, response) => callback(err && response));
	});
	return SuperAdmin;
};

SuperAdmin.save = function(callback, stats) {

	APPLICATIONS.quicksort('priority_desc');

	for (var i = 0; i < APPLICATIONS.length; i++) {
		var app = APPLICATIONS[i];
		if (app.current) {

			var current = app.current;
			var obj = {};
			obj.id = app.id;
			obj.url = app.url;
			obj.name = app.name;
			obj.category = app.category;
			obj.note = app.note;
			obj.port = current.port;
			obj.pid = current.pid;
			obj.cpu = current.cpu;
			obj.memory = current.memory;
			obj.openfiles = current.openfiles;
			obj.connections = current.connections;
			obj.hdd = current.hdd;
			obj.version = app.version;
			obj.analyzator = app.analyzatoroutput;
			obj.ssl = app.ssl;
			obj.dtmonitor = NOW;
			obj.dttms = NOW;

			delete app.current.TYPE;
			delete app.current.id;
			delete app.current.analyzator;
		}
	}

	var content = JSON.stringify(APPLICATIONS);
	Fs.writeFile(PATH.databases('applications.json'), content, callback || NOOP);
	stats && Fs.appendFile(PATH.databases('applications.backup'), NOW.format('yyyy-MM-dd HH:mm') + ' | ' + content + '\n', callback || NOOP);
	return SuperAdmin;
};

SuperAdmin.savestats = function(callback) {

	var updated = PREF.stats_update;

	if (updated === undefined) {
		PREF.set('stats_update', NOW);
		callback && callback(null, false);
		return SuperAdmin;
	}

	if (updated.getDate() === NOW.getDate()) {
		callback && callback(null, false);
		return SuperAdmin;
	}

	var db = NOSQL('stats');
	var builder = [];

	for (var i = 0; i < APPLICATIONS.length; i++) {

		var item = APPLICATIONS[i];
		if (!item.stats || !item.current)
			continue;

		item.current.interval = 0;

		var stats = CLONE(item.stats);
		delete stats.TYPE;
		stats.id = stats.id;
		stats.url = item.url;
		stats.datecreated = NOW;

		db.insert(stats);
		builder.push(stats);
		item.stats = {};
	}

	if (CONF.emailsummarization && builder.length) {
		builder.date = NOW.add('-1 day');
		var addresses = CONF.emailsummarization.split(',').trim();
		var msg = MAIL(addresses[0], CONF.name + ': @(Daily summarization) - ' + builder.date.format('dd. MMMM yyyy'), 'mails/summarization', builder, '');
		for (var i = 1; i < addresses.length; i++)
			msg.to(addresses[i]);
	}

	PREF.set('stats_update', NOW);
	callback && callback(null, true);
	return SuperAdmin;
};

SuperAdmin.resolvenginx = function(callback) {

	var paths = ['/usr/sbin/nginx', '/usr/local/sbin/nginx', '/usr/local/nginx', 'nginx'];
	var check = function(path) {
		if (!path)
			throw new Error('NGINX not found');
		SHELL(path + ' -v', function(err, response, version) {
			if (version) {
				SuperAdmin.options.nginxpath = path;
				callback();
			} else
				check(paths.shift());
		});
	};

	SHELL('which nginx', function(err, response) {

		if (response) {
			response = response.trim();
			if (response)
				paths.unshift(response);
		}

		check(paths.shift());
	});
};

SuperAdmin.resolveacme = function(callback) {
	var paths = ['/root/.acme.sh/acme.sh', 'acme.sh'];
	var check = function(path) {
		if (!path)
			throw new Error('ACME.SH not found');
		SHELL(path + ' -v', function(err, response) {
			if (response) {
				SuperAdmin.options.acmepath = path;
				callback();
			} else
				check(paths.shift());
		});
	};
	check(paths.shift());
};

SuperAdmin.load = function(callback) {
	SuperAdmin.resolvenginx(function() {
		SuperAdmin.resolveacme(function() {
			Fs.readFile(PATH.databases('applications.json'), function(err, response) {

				response && (APPLICATIONS = response.toString('utf8').parseJSON(true));

				// Resets PID
				for (var i = 0; i < APPLICATIONS.length; i++) {
					var item = APPLICATIONS[i];
					item.pid = 0;
					item.linker = item.url.superadmin_linker(item.path);
					!item.priority && (item.priority = 0);
					!item.delay && (item.delay = 0);
					!item.analyzatoroutput && (item.analyzatoroutput = null);
					if (item.version == null) {
						if (item.startscript === 'index.js') {
							item.version = 'total4';
							item.startscript = '';
						} else if (item.startscript)
							item.version = '';
						else
							item.version = 'total3';
					}
				}

				// RUNS APPLICATIONS
				APPLICATIONS.quicksort('priority_desc');
				callback && callback();
			});
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

	if (app.version === '' && app.startscript) {
		callback();
		return;
	}

	var linker = app.linker;
	var directory = Path.join(CONF.directory_www, linker);

	if (app.version === 'npmstart') {
		SHELL('mkdir -p ' + directory, function() {
			SHELL('chmod 777 {0}'.format(directory), function() {
				var filename = Path.join(directory, 'index.js');
				Fs.lstat(filename, function(err) {
					if (err) {
						SuperAdmin.copy(PATH.private('index.js'), Path.join(directory, 'index.js'), function(err) {
							callback(err);
						}, (response) => Tangular.render(response.toString('utf8'), { value: { total: 'total4' }}).replace(/\n{3,}/g, '\n\n'));
					} else
						callback();
				});
			});
		});
		return;
	}

	var data = {};

	data.total = app.version === 'total3' ? 'total.js' : app.version;
	data.threads = app.threads ? app.threads === '-' ? 'true' : ('\'' + app.threads + '\'') : '';
	data.servicemode = app.servicemode;
	data.watcher = app.watcher;

	if (app.editcode && app.editcode.length > 7)
		data.editcode = app.editcode;

	// Old format
	if (typeof(app.cluster) === 'number') {
		app.cluster = app.cluster + '';
	}

	data.cluster = app.cluster;

	if (!data.cluster || data.cluster === '1') {
		data.cluster = 0;
	} else {
		if (data.cluster === 'auto')
			data.cluster = '\'auto\'';
		else
			data.cluster = data.cluster.parseInt();

		if (data.cluster === 0)
			data.cluster = '';
	}

	data.unixsocket = CONF.unixsocket && app.unixsocket ? Path.join(CONF.directory_www, app.linker, 'superadmin.socket') : null;

	// data.cluster = data.threads ? app.cluster <= 1 || app.cluster === 'auto' ? '\'auto\'' : app.cluster : 0;
	SHELL('mkdir -p ' + directory, function() {
		SHELL('chmod 777 {0}'.format(directory), function() {
			SuperAdmin.copy(PATH.private('index.js'), Path.join(directory, 'index.js'), function(err) {
				callback(err);
			}, (response) => Tangular.render(response.toString('utf8'), { value: data }).replace(/\n{3,}/g, '\n\n'));
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
	var filename = PATH.databases('acmethumbprint.txt');
	Fs.readFile(filename, function(err, data) {

		if (data) {
			SuperAdmin.options.acmethumbprint = data.toString('utf8');
			if (SuperAdmin.options.acmethumbprint) {
				callback();
				return;
			}
		}

		SHELL(SuperAdmin.options.acmepath + ' --register-account', function(err, response) {
			var index = response.indexOf('ACCOUNT_THUMBPRINT=');
			SuperAdmin.options.acmethumbprint = response.substring(index + 20, response.indexOf('\'', index + 21));
			Fs.writeFile(filename, SuperAdmin.options.acmethumbprint, NOOP);
			callback();
		});
	});

	return SuperAdmin;
};

SuperAdmin.defaultssl = function(callback) {

	var filename = Path.join(CONF.directory_ssl, 'superadmin.key');

	Fs.lstat(filename, function(err) {

		if (err) {
			Fs.copyFile(PATH.private('superadmin.key'), filename, NOOP);
			Fs.copyFile(PATH.private('superadmin.csr'), Path.join(CONF.directory_ssl, 'superadmin.csr'), NOOP);
		}

		callback();
	});

};

SuperAdmin.init = function() {
	SuperAdmin.version_update(function() {
		SuperAdmin.defaultssl(function() {
			$WORKFLOW('Settings', 'load', function() {
				EMIT('settings');
				SuperAdmin.acmethumbprint(function() {
					SuperAdmin.load(function() {
						SuperAdmin.versions(function() {
							APPLICATIONS.wait(function(item, next) {

								if (item.stopped) {
									next();
									return;
								}

								SuperAdmin.pid(item.port, function(err, pid) {
									if (pid)
										next();
									else
										SuperAdmin.run(item.port, () => next());
								});
							});

							// Runs sys info
							setInterval(SuperAdmin.sysinfo, 30000);
							SuperAdmin.sysinfo();
						});
					});
				});
			});
		});
	});
	SuperAdmin.logger('init: SuperAdmin');
	return SuperAdmin;
};

SuperAdmin.version_update = function(callback) {

	var version = PREF.version || 0;

	if (version >= 9) {
		callback();
		return;
	}
	var async = [];

	// Upadte DB of alarms
	async.push(function(next) {
		// unlink old alarms
		var filename = PATH.databases('alarms.nosql');
		Fs.unlink(filename, () => next());
	});

	// Update DB of apps
	async.push(function(next) {
		var filename = PATH.databases('applications.json');
		Fs.readFile(filename, function(err, buffer) {
			if (buffer) {
				var data = JSON.parse(buffer.toString('utf8'));
				for (var i = 0; i < data.length; i++) {
					var item = data[i];
					item.dtcreated = item.datecreated;
					item.dtupdated = item.dateupdated;
					delete item.datecreated;
					delete item.dateupdated;
					delete item.currentmonitor;
				}
				Fs.writeFile(filename, JSON.stringify(data), () => next());
			} else
				next();
		});
	});

	async.push(function(next) {
		NOSQL('notifications').remove();
		PREF.set('version', SuperAdmin.server.version_superadmin);
		next();
	});

	async.async(callback);
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

	message && LOGGER('logger', controller && controller.user ? ('[' + controller.user.name + ']') : '[nobody]', message, controller ? controller.ip : 'root');
	return SuperAdmin;
};

SuperAdmin.send_notify = function(type, body) {
	PREF.set('notifications', (PREF.notifications || 0) + 1);
	NOSQL('notifications').insert({ type: type, body: body, dtcreated: NOW });
};

SuperAdmin.init();

Spawn('mpstat', ['-P', 'ALL', '10']).stdout.on('data', function(response) {

	response.toString('utf8').parseTerminal(function(arr) {
		if (arr[2] === 'all')
			SuperAdmin.server.cpu = +arr[3];
		else
			SuperAdmin.server.cpucores[+arr[2]] = +arr[3];
	}, 1);

});