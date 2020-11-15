function service_info() {
	$WORKFLOW('Apps', 'info', () => setTimeout(service_info, 60000));
}

function service_analyzator() {
	$WORKFLOW('Apps', 'analyzator', () => setTimeout(service_analyzator, 120000));
}

ON('settings', function() {
	service_info();
	service_analyzator();
});

// Saves current apps state
ON('service', function(counter) {

	counter % 2 === 0 && SuperAdmin.save();

	if (!CONF.allowbackup || !CONF.intervalbackup)
		return;

	if ((counter / 60) % CONF.intervalbackup !== 0)
		return;

	SuperAdmin.logger('backup');

	APPLICATIONS.wait(function(item, next) {
		if (item.backup)
			SuperAdmin.backupapp(item, next);
		else
			next();
	});
});

ON('superadmin_app_restart', function(app) {

	if (!app)
		return;

	!app.stats && (app.stats = {});

	if (app.stats.restarts)
		app.stats.restarts++;
	else
		app.stats.restarts = 1;
});