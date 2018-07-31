// Consuption
function execInfo() {
	$$$('Application').workflow2('info', () => setTimeout(execInfo, F.global.settings.intervalconsumption));
}

// Total.js analyzator
function execAnalyzator() {
	$$$('Application').workflow2('analyzator', () => setTimeout(execAnalyzator, F.global.settings.intervalanalyzator));
}

ON('settings', function() {
	execInfo();
	execAnalyzator();
});

// Saves current apps state
ON('service', function(counter) {
	counter % 2 === 0 && SuperAdmin.save();

	if (!F.global.settings.allowbackup)
		return;

	if ((counter / 60) % F.global.settings.intervalbackup !== 0)
		return;

	SuperAdmin.logger('backup');

	APPLICATIONS.wait(function(item, next) {
		if (item.backup)
			SuperAdmin.backupapp(item, next);
		else
			next();
	});
});

ON('superadmin.app.restart', function(app) {

	if (!app)
		return;

	!app.stats && (app.stats = {});

	if (app.stats.restarts)
		app.stats.restarts++;
	else
		app.stats.restarts = 1;
});