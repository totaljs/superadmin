exports.install = function() {
	F.route('/*', 'index', ['authorize']);
	F.route('/', 'login', ['unauthorize']);
	F.route('/logoff', redirect_logoff);
	F.localize('/templates/*.html', ['compress']);
};

function redirect_logoff() {
	var self = this;
	self.cookie('__sa', '', '-1 day');
	self.redirect('/');
}