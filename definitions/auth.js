const SA = { id: '0', name: 'SuperAdmin', roles: EMPTYARRAY };
var DDOS = {};

F.onAuthorize = function(req, res, flags, callback) {
	var cookie = req.cookie('__sa');
	if (!cookie || cookie.parseInt() !== F.config.superadmin.hash()) {
		if (DDOS[req.ip] > 4)
			return callback(false);
		if (!DDOS[req.ip])
			DDOS[req.ip] = 0;
		DDOS[req.ip]++;
		return callback(false);
	}

	callback(true, SA);
};

F.on('service', function(interval) {
	if (interval % 10 === 0)
		DDOS = {};
});