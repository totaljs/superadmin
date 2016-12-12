var DDOS = {};

NEWSCHEMA('Login').make(function(schema) {

	schema.define('name', 'String(30)', true);
	schema.define('password', 'String(30)', true);

	schema.addWorkflow('exec', function(error, model, controller, callback) {

		if (DDOS[controller.ip] > 3) {
			error.push('error-credentials');
			return callback();
		}

		var id = (model.name + ':' + model.password).hash();

		if (F.config.superadmin.hash() !== id) {
			error.push('error-credentials');

			if (DDOS[controller.ip])
				DDOS[controller.ip]++;
			else
				DDOS[controller.ip] = 1;

			return callback();
		}

		F.logger('access', controller.ip, controller.req.headers.useragent);
		controller.cookie(F.config.cookie, id, '5 days');
		callback(SUCCESS(true));
	});

});

F.on('service', function(interval) {
	if (interval % 10 === 0)
		DDOS = {};
});