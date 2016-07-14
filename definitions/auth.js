F.onAuthorize = function(req, res, flags, callback) {
	var user = SINGLETON('user');

	if (!user.name) {
		user.id = '0';
		user.name = 'SuperAdmin';
		user.roles = [];
		user.su = true;
	}

	callback(true, user);
};