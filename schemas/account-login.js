NEWSCHEMA('Account/Login', function(schema) {

	schema.define('login', String, true);
	schema.define('password', String, true);

	schema.addWorkflow('exec', function($, model) {

		if (BLOCKED($, 5)) {
			$.invalid('401');
			return;
		}

		model.password = model.password.sha256(CONF.session_secret);

		NOSQL('users').read().fields('id,isdisabled').where('login', model.login).where('password', model.password).callback(function(err, response) {

			if (response) {

				if (response.isdisabled) {
					$.invalid('error-disabled');
					return;
				}

				var session = {};
				session.id = UID();
				session.userid = response.id;
				session.dtcreated = NOW;
				session.ua = $.ua;
				session.ip = $.ip;

				// Uncomment:
				// PREF.set('credentials', null);

				NOSQL('sessions').insert(session).callback(function() {
					MAIN.session.authcookie($, session.id, session.userid, '1 week');
					$.success();
				});

			} else
				$.invalid('error-credentials');

		});

	});

});