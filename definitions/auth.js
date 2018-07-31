const SA = { id: '0', name: 'SuperAdmin' };
const MAXATTEMPTS = 3;

var DDOS = {};

F.onAuthorize = function(req, res, flags, callback) {

	if (req.headers['x-token']) {
		var token = F.global.settings.tokens.findItem('id', req.headers['x-token']);
		if (!token) {

			if (DDOS[req.ip] > MAXATTEMPTS) {
				F.logger('blocked', req.ip, req.headers.useragent);
				return callback(false);
			}

			if (DDOS[req.ip])
				DDOS[req.ip]++;
			else
				DDOS[req.ip] = 1;
		}

		return token ? callback(true, token) : callback(false);
	}

	var cookie = req.cookie(F.config.cookie);
	if (!cookie || cookie.parseInt() !== F.config.superadmin.hash()) {

		if (DDOS[req.ip] > MAXATTEMPTS) {
			F.logger('blocked', req.ip, req.headers.useragent);
			return callback(false);
		}

		if (DDOS[req.ip])
			DDOS[req.ip]++;
		else
			DDOS[req.ip] = 1;

		return callback(false);
	}

	SA.ip = req.ip;
	SA.filebrowser = F.config['allow-filebrowser'];
	callback(true, SA);
};

F.on('service', function(interval) {
	interval % 10 === 0 && (DDOS = {});
});