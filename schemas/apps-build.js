const Fs = require('fs');
const Path = require('path');

NEWSCHEMA('Apps/Build', function(schema) {

	schema.define('design', String, true);
	schema.define('compiled', String, true);

	schema.setRead(function($) {

		var item = APPLICATIONS.findItem('id', $.id);

		if (!item) {
			$.invalid(404);
			return;
		}

		var filename = Path.join(CONF.directory_www, item.linker, 'builds', 'app.build');
		Fs.readFile(filename, function(err, data) {
			if (err) {
				$.callback(null);
			} else {
				$.controller.binary(data, 'application/json');
				$.cancel();
			}
		});
	});

	schema.setSave(function($, model) {

		var item = APPLICATIONS.findItem('id', $.id);

		if (!item) {
			$.invalid(404);
			return;
		}

		var directory = Path.join(CONF.directory_www, item.linker, 'builds');
		var filename = Path.join(CONF.directory_www, item.linker, 'builds', 'app.build');

		Fs.mkdir(directory, function() {
			Fs.writeFile(filename, JSON.stringify(model), $.successful(function() {
				if (item.debug || item.stopped)
					$.success();
				else
					$ACTION('GET *Apps --> restart', null, $.done(), $);
			}));
		});
	});

});