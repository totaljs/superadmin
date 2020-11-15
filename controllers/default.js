exports.install = function() {
	ROUTE('/*', 'index', ['authorize']);
	ROUTE('/*', 'login', ['unauthorize']);
	ROUTE('/logoff', redirect_logoff);
};

function redirect_logoff() {
	var self = this;
	SuperAdmin.logger('logoff', self);
	self.cookie('__sa', '', '-1 day');
	self.redirect('/');
}