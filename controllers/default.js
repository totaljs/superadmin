exports.install = function() {
	ROUTE('+GET /*', index);
	ROUTE('-GET /*', 'login');
	ROUTE('+GET /logoff', logout);
};

function index() {

	var self = this;
	var plugins = [];

	for (var key in F.plugins) {
		var item = F.plugins[key];
		if (self.user.sa || !item.visible || item.visible(self.user)) {
			var obj = {};
			obj.id = item.id;
			obj.routes = item.routes;
			obj.position = item.position;
			obj.name = TRANSLATOR(self.user.language || '', item.name);
			obj.icon = item.icon;
			obj.import = item.import;
			plugins.push(obj);
		}
	}

	plugins.quicksort('position');
	self.view('index', plugins);
}

function logout() {
	var $ = this;
	SuperAdmin.logger('logoff', $);
	$.cookie('__sa', '', '-1 day');
	$.redirect('/');
}