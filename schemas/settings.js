const Fs = require('fs');

NEWSCHEMA('Settings', function(schema) {

	var settings = [];

	// General
	settings.push({ group: 'General', label: 'Name', name: 'name', type: 'string', value: 'SuperAdmin' });
	settings.push({ group: 'General', label: 'Daily summarization', name: 'emailsummarization', type: 'string', value: '', note: 'Type your e-mail address', placeholder: '@' });
	settings.push({ group: 'General', label: 'Total.js API key', name: 'totalapi', type: 'string', value: '', note: 'Needed for SMS and you can obtain key on https://platform.totaljs.com/?open=api', placeholder: 'Your API token' });

	// Alarms
	settings.push({ group: 'SMS notifications', label: 'A sender name', name: 'sms_from', type: 'string', value: 'SuperAdmin' });

	// SMTP
	settings.push({ group: 'SMTP server', label: 'Use Total.js API', name: 'mail_api', type: 'boolean', value: false, note: 'SuperAdmin uses Total.js API services for sending of mail messages' });
	settings.push({ group: 'SMTP server', label: 'Hostname', name: 'mail_smtp', type: 'string', value: '', show: 'data => !data.mail_api' });
	settings.push({ group: 'SMTP server', label: 'Options', name: 'mail_smtp_options', type: 'string', value: {}, note: 'Follow: https://docs.totaljs.com/total4/4047c001sd51c/#4c10a001bl51c', show: 'data => !data.mail_api' });
	settings.push({ group: 'SMTP server', label: 'Sender address', name: 'mail_address_from', type: 'string', value: '', placeholder: '@', note: 'Type sender e-mail address' });

	// Backup
	settings.push({ group: 'Backup', label: 'Allow FTP backups', name: 'allowbackup', type: 'boolean', value: false });
	settings.push({ group: 'Backup', label: 'FTP server', name: 'ftp', type: 'string', value: '', placeholder: 'ftp://username:password@hostname', show: 'data => data.allowbackup' });
	settings.push({ group: 'Backup', label: 'Backup interval', name: 'intervalbackup', type: 'number', value: 6, note: 'Must be defined in hours', show: 'data => data.allowbackup' });

	// Schema definition
	for (var i = 0; i < settings.length; i++)
		schema.define(settings[i].name, settings[i].type);

	var save = function($, model) {

		var keys = Object.keys(model);

		for (var i = 0; i < keys.length; i++) {
			var key = keys[i];
			var val = model[key];
			CONF[key] = val;
			var item = settings.findItem('name', key);
			if (item)
				item.value = val;
		}

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

		var tmp = CLONE(settings);
		var item = tmp.findItem('name', 'mail_smtp_options');
		if (item && item.value)
			item.value = JSON.stringify(item.value);

		$.callback(tmp);
	});

	schema.addWorkflow('load', function($) {
		Fs.readFile(PATH.databases('settings.json'), function(err, response) {
			var data = response ? response.toString('utf8').parseJSON(true) : {};
			for (var i = 0; i < schema.fields.length; i++) {
				var key = schema.fields[i];
				var val = data[key];
				if (val != null) {
					if (val instanceof Array)
						val = val.join(', ');
					CONF[key] = val;
					var item = settings.findItem('name', key);
					if (item)
						item.value = val;
				}
			}

			CMD('clear_smtpcache');
			$.success();
		});
	});

});