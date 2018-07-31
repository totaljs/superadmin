const Fs = require('fs');

NEWSCHEMA('SettingsToken').make(function(schema) {
	schema.define('id', 'Lower(50)', true);
	schema.define('name', 'String(30)', true);
});

NEWSCHEMA('Settings').make(function(schema) {

	schema.define('emailsummarization', '[Email]');
	schema.define('tokens', '[SettingsToken]');
	schema.define('intervalconsumption', 'Number', true);
	schema.define('intervalanalyzator', 'Number', true);
	schema.define('intervalbackup', 'Number', true);
	schema.define('autorenew', Boolean);
	schema.define('allowbackup', Boolean);
	schema.define('ftp', String);
	schema.define('templates', 'Url');
	schema.define('nexmokey', 'String');
	schema.define('nexmosecret', 'String');
	schema.define('nexmosender', 'String(30)');

	schema.setDefault(function(name) {
		switch (name) {
			case 'nexmosender':
				return F.config.name;
			case 'intervalconsumption':
				return 15000; // 15 seconds
			case 'intervalanalyzator':
				return 120000; // 2 minutes
			case 'intervalbackup':
				return 4; // each 4 hours
			case 'templates':
				return 'https://cdn.totaljs.com/2017xc9db052e/superadmin.json';
		}
	});

	schema.setSave(function(error, model, options, callback, controller) {
		var raw = model.$clean();
		F.global.settings = raw;
		Fs.writeFile(F.path.databases('settings.json'), JSON.stringify(raw), NOOP);
		callback(SUCCESS(true));
		SuperAdmin.logger('save: settings', controller);
		EMIT('superadmin.settings', raw);
	});

	schema.setGet(function(error, model, options, callback) {
		Fs.readFile(F.path.databases('settings.json'), function(err, data) {
			!err && (data = data.toString('utf8').parseJSON());
			F.global.settings = data ? U.copy(data, model.$clean()) : model.$clean();
			callback(F.global.settings);
		});
	});
});