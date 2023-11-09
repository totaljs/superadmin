const Fs = require('fs');
const Opt = { encoding: 'utf8' };

exports.install = function(options) {
	var url = CONF.monitor_url;
	if (options && options.url)
		url = options.url;
	if (!url)
		url = '/$usage/';
	ROUTE('GET ' + url, send);
};

function send() {
	var self = this;
	Fs.readFile(process.mainModule.filename + '.json', Opt, function(err, response) {
		self.content(response ? response : 'null', 'text/json');
	});
}