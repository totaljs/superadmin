exports.icon = 'ti ti-rocket';
exports.name = '@(Apps)';
exports.permissions = [{ id: 'apps', name: 'apps' }];
exports.position = 1;
exports.visible = user => user.sa || user.permissions.includes('apps');

exports.install = function() {
	ROUTE('+API    /api/    -apps_query           *Apps   --> query');
	ROUTE('+API    /api/    -apps_read/{id}       *Apps   --> read');
	ROUTE('+API    /api/    -apps_analyzator      *Apps   --> analyzator');
	ROUTE('+API    /api/    -apps_restart/{id}    *Apps   --> restart');
	ROUTE('+API    /api/    -apps_restart_all     *Apps   --> restart_all');
	ROUTE('+API    /api/    +apps_save            *Apps   --> check port save (response)', [120000]);
	ROUTE('+API    /api/    -apps_remove/{id}     *Apps   --> remove');
	ROUTE('+API    /api/    -apps_stop/{id}       *Apps   --> stop');
	ROUTE('+API    /api/    -apps_stop_all        *Apps   --> stop_all');
};