const Path = require('path');
const Fs = require('fs');
const Exec = require('child_process').exec;

NEWTASK('ssl', function(push) {

	// $.value {String} a domain name

	push('init', function($, value) {
		var filename = Path.join(CONF.directory_ssl, value, value + '.cer');
		Fs.lstat(filename, err => $.next(err ? 'create' : 'check'));
	});

	// Checks validity
	push('check', function($, value) {
		Exec('cat {0} | openssl x509 -noout -enddate'.format(Path.join(CONF.directory_ssl, value, value + '.cer')), function(err, response) {

			if (err) {
				// Certificate not found, we make it
				$.next('create');
				return;
			}

			var index = response.indexOf('=');
			if (index !== -1) {
				var expire = new Date(Date.parse(response.substring(index + 1).trim()));

				// Certificate will expire less than 10 days
				if (expire.diff('days') < 10)
					$.next('renew');
				else
					$.next('done');
			}

		});
	});

	push('renew', function($, value) {
		Exec(SuperAdmin.options.acmepath + ' --certhome {0} --{3} -d {1} -w {2} --stateless'.format(CONF.directory_ssl, value, CONF.directory_acme, 'renew --force'), function(err) {

			SuperAdmin.send_notify(err ? 'warning' : 'success', err ? TRANSLATOR('', '@(A problem with renewing of SSL certificate for domain <b>{0}</b>. Error: {1})').format(value, err.message) : TRANSLATOR('', '@(SSL certificate has been renewed successfully for <b>{0}</b>)').format(value));

			if (err)
				$.invalid('error-ssl-renew', value + ': ' + err);
			else
				$.next('done');
		});
	});

	push('create', function($, value) {
		Exec(SuperAdmin.options.acmepath + ' --certhome {0} --{3} -d {1} -w {2} --stateless'.format(CONF.directory_ssl, value, CONF.directory_acme, 'issue --force'), function(err) {
			if (err)
				$.invalid('error-ssl-create', value + ': ' + err);
			else
				$.next('done');
		});
	});

	push('done', function($, value) {
		var obj = {};
		var format = CONF.ssl_format || '{0}';
		obj.domain = value;
		obj.ssl_cer = CONF.directory_ssl + format.format(value) + '/fullchain.cer';
		obj.ssl_key = CONF.directory_ssl + format.format(value) + '/' + value + '.key';
		$.success(obj);
	});

});