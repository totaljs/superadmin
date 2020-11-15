NEWSCHEMA('Account', function(schema) {

	schema.define('name', String, true);
	schema.define('login', String, true);
	schema.define('password', String);

	schema.setRead(function($) {
		NOSQL('users').read().fields('-password').id($.user.id).callback($.callback);
	});

	schema.setSave(function($, model) {
		model.password = model.password ? model.password.sha256(CONF.session_secret) : undefined;
		NOSQL('users').modify(model).id($.user.id).callback($.done());
	});

	schema.addWorkflow('logout', function($) {
		MAIN.session.logout($);
		$.success();
	});

});