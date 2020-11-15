const Exec = require('child_process').exec;

NEWSCHEMA('Operations', function(schema) {

	schema.addWorkflow('backup', function($) {
		SuperAdmin.logger('backup: all', $);
		SuperAdmin.backup($.successful(function(filename) {
			$.controller.file('~' + filename, U.getName(filename));
			$.cancel();
		}));
	});

	schema.addWorkflow('fixpermissions', function($) {
		Exec('chown -R {0}:{1} /www/www/*'.format(SuperAdmin.run_as_user.group, SuperAdmin.run_as_user.id), $.done());
	});

	schema.addWorkflow('updatetotal', function($) {
		Exec(PATH.databases('update-total.sh'), $.done());
	});

});