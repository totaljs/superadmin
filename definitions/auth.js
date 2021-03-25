var opt = {};

opt.secret = CONF.session_secret;
opt.cookie = CONF.session_cookie;
opt.ddos = 10;
opt.options = { samesite: 'lax', httponly: true };

opt.onread = function(meta, next) {

	// meta.sessionid {String}
	// meta.userid {String}
	// meta.ua {String} A user-agent

	NOSQL('sessions').read().id(meta.sessionid).where('userid', meta.userid).where('ua', meta.ua).callback(function(err, response) {
		if (response) {

			// Updates session
			NOSQL('sessions').modify({ '+logged': 1, dtlogged: NOW }).id(meta.sessionid);

			// Reads & Updates user profile
			var db = NOSQL('users');
			db.mod({ '+logged': 1, dtlogged: NOW, isonline: true }).id(meta.userid).where('isdisabled', false);
			db.one().fields('id,name,sa').id(meta.userid).where('isdisabled', false).callback(next);

		} else
			next();
	});
};

opt.onfree = function(meta) {
	if (meta.users.length)
		NOSQL('users').mod({ isonline: false }).in('id', meta.users);
};

AUTH(opt);
MAIN.session = opt;
NOSQL('users').mod({ isonline: false }).where('isonline', true);