const Path = require('path');
const Fs = require('fs');
const Exec = require('child_process').exec;

NEWTASK('nginx', function(push) {

	// $.value {String} Application ID or Application instance

	push('init', function($) {

		var app = typeof($.value) === 'object' ? $.value : null;
		var value = $.value = { id: $.value };

		// APP ID
		if (!app)
			app = APPLICATIONS.findItem('id', $.value.id);

		if (app) {

			value.filename = Path.join(CONF.directory_nginx, app.linker + '.conf');

			var model = value.model = {};
			var domains = [];

			model.domain = app.url.superadmin_url();
			app.domains = model.domain.superadmin_domains();
			app.ssl = app.url.startsWith('https://');

			for (var i = 0; i < app.domains.length; i++)
				domains.push({ domain: app.domains[i], ssl_cer: CONF.directory_ssl + 'superadmin.csr', ssl_key: CONF.directory_ssl + 'superadmin.key' });

			if (app.redirect) {
				for (var i = 0; i < app.redirect.length; i++) {
					var d = app.redirect[i];
					if (!domains.findItem('domain', d))
						domains.push({ domain: d, ssl_cer: CONF.directory_ssl + 'superadmin.csr', ssl_key: CONF.directory_ssl + 'superadmin.key' });
				}
			}

			model.isssl = app.ssl;
			model.domains = domains;
			model.acmethumbprint = SuperAdmin.options.acmethumbprint;
			model.linker = app.linker;
			model.islogging = app.accesslog;
			model.allowedip = app.allow;
			model.blockedip = app.disallow;
			model.uploadquote = app.size;
			model.ddosquote = app.ddosquote;
			model.proxytimeout = app.proxytimeout;
			model.port = app.port;
			model.threads = app.threads;

			if (CONF.unixsocket && app.unixsocket)
				model.unixsocket = Path.join(CONF.directory_www, app.linker, 'superadmin.socket');

			// Custom keys
			if (app.ssl) {

				if (app.ssl_cer && app.ssl_key) {
					model.ssl_cer = app.ssl_cer;
					model.ssl_key = app.ssl_key;
				} else {
					// Default self-signed certificate
					model.ssl_cer = CONF.directory_ssl + 'superadmin.csr';
					model.ssl_key = CONF.directory_ssl + 'superadmin.key';
					model.ssl_generate = true;
				}

				if (domains.length > 1)
					model.redirectssl = domains[1];

				// http2https redirect
				model.redirect = domains;

			} else {

				// http2http redirect
				if (domains.length > 1)
					model.redirect = [domains[1]];
			}

			$.next('create');

		} else
			$.invalid('404');
	});

	// Creates NGINX configuration
	push('create', function($, value) {
		Fs.readFile(PATH.private('nginx.conf'), function(err, response) {
			response = response.toString('utf8');
			Fs.writeFile(value.filename, VIEWCOMPILE(response, value.model).trim().replace(/\n\t\n/g, '\n').replace(/\n{3,}/g, '\n'), $.next2('test'));
		});
	});

	// Tests NGINX configuration
	push('test', function($, value) {
		Exec(SuperAdmin.options.nginxpath + ' -t', function(err) {
			if (err) {
				// ERROR
				// We need to remove the config
				Fs.unlink(value.filename, NOOP);
				$.invalid(err);
			} else {
				Exec(SuperAdmin.options.nginxpath + ' -s reload', function(err, response, output) {
					if (err) {
						// Unhandled problem
						// Maybe remove a config file?
						$.invalid(err);
					} else if (value.model.isssl && !value.isssl && value.model.ssl_generate) {
						value.isssl = true;
						$.next('ssl');
					} else
						$.success(true, output);
				});
			}
		});
	});

	push('ssl', function($, value) {
		var domains = value.model.domains;
		domains.wait(function(item, next) {
			TASK('ssl/init', function(err, response) {
				if (response.success) {
					item.ssl_cer = response.value.ssl_cer;
					item.ssl_key = response.value.ssl_key;
					if (item.domain === value.model.domain) {
						value.model.ssl_cer = item.ssl_cer;
						value.model.ssl_key = item.ssl_key;
					}
				}
				next();
			}, $).value = item.domain;
		}, $.next2('create'));
	});

});