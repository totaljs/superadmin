var Fs = require('fs');
var Path = require('path');

NEWSCHEMA('Application').make(function(schema) {

	schema.define('id',         'UID');
	schema.define('url',        'Url', true);
	schema.define('redirect',   '[Url]');
	schema.define('allow',      '[String]');
	schema.define('disallow',   '[String]');
	schema.define('ssl_key',    'String');
	schema.define('ssl_cer',    'String');
	schema.define('nginx',      'String');                  // Additional NGINX settings (lua)
	schema.define('port',        Number);
	schema.define('cluster',     Number);                   // Thread count
	schema.define('ddos',        Number);                   // Maximum count of request per second
	schema.define('debug',       Boolean);                  // Enables debug mode

	schema.setQuery(function(error, options, callback) {
		callback([]);
	});

	schema.setSave(function(error, model, options, callback) {

		var plain = model.$plain();

		if (!model.id) {
			plain.id = model.id = UID();
			DB('applications').insert(plain).callback(() => callback(SUCCESS(true)));
			return;
		}

		delete plain.id;
		DB('applications').modify(plain).where('id', model.id).callback(() => callback(SUCCESS(true)));
	});

	schema.addOperation('start', function(error, model, options, callback) {
		// starts app
	});

	schema.addOperation('restart', function(error, model, options, callback) {
		// restarts app
	});

	schema.addOperation('stop', function(error, model, options, callback) {
		// stops app
	});

	schema.addOperation('monitor', function(error, model, options, callback) {
		// reads monitor
	});

	schema.addWorkflow('info', function(error, model, options, callback) {
		// get temporary size
		// get cpu %
		// get memory
		// get opened files
		// get PID
	});

	// Checks port number
	schema.addWorkflow('port', function(error, model, options, callback) {
		NOSQL('applications').find().make(function(builder) {
			builder.fields('url', 'port');
			builder.callback(function(err, response) {
				if (model.port) {
					if (!port_check(response, model.id, model.port))
						error.push('error-port');
				} else
					model.port = port_create(response);
				callback(SUCCESS(true));
			});
		});
	});

	// Creates nginx configuration
	schema.addWorkflow('nginx', function(error, model, options, callback) {
		var url = model.url.replace(/^(http|https)\:\/\//gi, '').replace(/\//g, '');
		model.linker = url.linker();

		var filename = Path.join(CONFIG('directory-nginx'), model.linker + '.conf');
		var data = {};

		data.url = url;
		data.ssl = '';
		data.port = model.port;
		data.ddos = model.ddos;

		Fs.readFile(F.path.databases('website.conf'), function(err, response) {
			response = response.toString('utf8');
			Fs.writeFile(filename, F.view(response, data));
			error.push('error-port');
			callback();
		});
	});

	// Checks / creates ssl
	schema.addWorkflow('ssl', function(error, model, options, callback) {

	});

});


function port_create(arr) {
	var max = 7999;
	arr.forEach((item) => max = Math.max(max, item.port));
	while (true) {
		max++;
		var number = arr.findIndex('port', max);
		if (number === -1)
			return max;
	}
}

function port_check(arr, id, number) {
	var item = arr.findItem('port', number);
	return item && item.id === id;
}
