NEWSCHEMA('Users', function(schema) {

	schema.define('name', String, true);
	schema.define('login', String, true);
	schema.define('password', String);
	schema.define('sa', Boolean);
	schema.define('isdisabled', Boolean);

	schema.setQuery(function($) {
		if ($.user.sa)
			NOSQL('users').find().fields('id,name,login,isdisabled,dtcreated,dtlogged,sa,isonline').sort('dtcreated_asc').callback($.callback);
		else
			$.invalid('401');
	});

	schema.setRead(function($) {
		if ($.user.sa)
			NOSQL('users').read().fields('id,name,login,isdisabled,dtcreated,dtlogged,sa').id($.id).error('404').callback($.callback);
		else
			$.invalid('401');
	});

	schema.setInsert(function($, model) {

		if (!$.user.sa) {
			$.invalid('401');
			return;
		}

		model.id = UID();
		model.dtcreated = NOW;
		model.password = model.password.sha256(CONF.session_secret);
		NOSQL('users').insert(model).callback($.done());
	});

	schema.setUpdate(function($, model) {

		if (!$.user.sa) {
			$.invalid('401');
			return;
		}

		model.dtupdated = NOW;
		model.password = model.password ? model.password.sha256(CONF.session_secret) : undefined;
		NOSQL('users').modify(model).id($.id).callback($.done());

	});

	schema.setRemove(function($) {

		if (!$.user.sa || $.id === $.user.id) {
			$.invalid('401');
			return;
		}

		NOSQL('sessions').remove().where('userid', $.id);
		NOSQL('users').remove().id($.id).callback($.done());
	});

	NOSQL('users').read().callback(function(err, response) {
		// tries to find a user
		if (!response) {
			var password = GUID(10);
			model = {};
			model.id = UID();
			model.dtcreated = NOW;
			model.name = 'Total Admin';
			model.login = GUID(10);
			model.sa = true;
			model.isdisabled = false;
			model.password = password.sha256(CONF.session_secret);
			NOSQL('users').insert(model);
			PREF.set('credentials', { login: model.login, password: password });
		}
	});

});