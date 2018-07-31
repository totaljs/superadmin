var DDOS = {};

NEWSCHEMA('Login').make(function(schema) {

	schema.define('name', 'String(30)', true);
	schema.define('password', 'String(30)', true);

	schema.addWorkflow('exec', function($) {

		if (DDOS[$.controller.ip] > 3) {
			$.error.push('error-credentials');
			EMIT('superadmin.blocked', $.controller);
			return $.callback();
		}

		var model = $.model;
		var id = (model.name + ':' + model.password).hash();

		if (F.config.superadmin.hash() !== id) {

			$.error.push('error-credentials');

			if (DDOS[$.controller.ip])
				DDOS[$.controller.ip]++;
			else
				DDOS[$.controller.ip] = 1;

			return $.callback();
		}

		F.logger('access', $.controller.ip, $.controller.req.headers.useragent);
		$.controller.cookie(F.config.cookie, id, '5 days');
		EMIT('superadmin.login', $.controller);
		$.callback(SUCCESS(true));
	});

});

F.on('service', function(interval) {
	if (interval % 10 === 0)
		DDOS = {};
});