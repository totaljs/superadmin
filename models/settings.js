NEWSCHEMA('User').make(function(schema) {
	schema.define('login', 'String(30)', true);
	schema.define('password', 'String(30)', true);
});

NEWSCHEMA('Settings').make(function(schema) {
	schema.define('phone_error', '[Phone]');
	schema.define('phone_offline', '[Phone]');
	schema.define('nexmo_key', String);
	schema.define('nexmo_secret', String);
	schema.define('interval_system', Number);
	schema.define('interval_monitor', Number);
	schema.define('interval_apps', Number);
	schema.define('interval_sms', Number);
	schema.define('users', '[Users]');
});