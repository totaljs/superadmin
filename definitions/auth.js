const SA = { id: '0', name: 'SuperAdmin', roles: EMPTYARRAY };
var DDOS = {};

F.onAuthorize = function(req, res, flags, callback) {

	var cookie = req.cookie(F.config.cookie);
	if (!cookie || cookie.parseInt() !== F.config.superadmin.hash()) {

		if (DDOS[req.ip] > 3)
			return callback(false);

		if (DDOS[req.ip])
			DDOS[req.ip]++;
		else
			DDOS[req.ip] = 1;

		return callback(false);
	}

	SA.ip = req.ip;
	callback(true, SA);
};

F.on('service', function(interval) {
	if (interval % 10 === 0)
		DDOS = {};
});