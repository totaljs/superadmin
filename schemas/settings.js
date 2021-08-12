const Fs = require('fs');

NEWSCHEMA('Settings', function(schema) {

	schema.define('name', String, true);
	schema.define('emailsummarization', String);
	schema.define('totalapi', String);
	schema.define('allow_totalapi', Boolean);
	schema.define('allow_tms', Boolean);
	schema.define('sms_from', String);
	schema.define('secret_tms', String);
	schema.define('mail_api', Boolean);
	schema.define('mail_smtp', String);
	schema.define('mail_smtp_options', String);
	schema.define('mail_address_from', String);
	schema.define('allowbackup', Boolean);
	schema.define('ftp', String);
	schema.define('intervalbackup', Number);

	var save = function($, model) {
		LOADCONFIG(model);
		CMD('clear_smtpcache');
		Fs.writeFile(PATH.databases('settings.json'), JSON.stringify(model), $.done());
		SuperAdmin.logger('save: settings', $);
		EMIT('superadmin_settings', model);
	};

	schema.setSave(function($, model) {

		if (!$.user.sa) {
			$.invalid('401');
			return;
		}

		if (model.mail_smtp_options)
			model.mail_smtp_options = model.mail_smtp_options.parseJSON();

		if (model.mail_smtp) {
			Mail.try(model.mail_smtp, model.mail_smtp_options, $.successful(function() {
				save($, model);
			}));
		} else
			save($, model);

	});

	schema.setRead(function($) {

		if (!$.user.sa) {
			$.invalid('401');
			return;
		}

		var data = {};

		for (var key of schema.fields) {
			var value = CONF[key];
			if (value && typeof(value) === 'object')
				value = JSON.stringify(value);
			data[key] = value;
		}

		$.callback(data);
	});

	schema.addWorkflow('load', function($) {
		Fs.readFile(PATH.databases('settings.json'), function(err, response) {

			var data = response ? response.toString('utf8').parseJSON(true) : {};
			var isempty = false;

			if (data.name == null) {
				data.name = CONF.name;
				isempty = true;
			}

			if (data.sms_from == null)
				data.sms_from = CONF.name;

			if (data.allow_tms == null)
				data.allow_tms = false;

			if (data.allow_totalapi == null)
				data.allow_totalapi = false;

			if (data.intervalbackup == null)
				data.intervalbackup = 6;

			if (data.allowbackup == null)
				data.allowbackup = false;

			if (!isempty)
				LOADCONFIG(data);

			$.success();
		});
	});

});