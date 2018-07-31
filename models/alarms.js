NEWSCHEMA('AlarmRule').make(function(schema) {
	schema.define('path', 'String(50)', true);
	schema.define('value', Number);
	schema.define('type', 'String(20)', true); // ">", "<", ">=", "<=" or "="
});

NEWSCHEMA('Alarm').make(function(schema) {

	schema.define('id', 'UID');
	schema.define('idapplication', 'UID');
	schema.define('name', 'String(50)');
	schema.define('rules', '[AlarmRule]', true);
	schema.define('message', 'String(100)', true);
	schema.define('phone', '[Phone]');
	schema.define('email', '[Email]');
	schema.define('delay', 'String(30)');
	schema.define('debug', Boolean);  // debug --> will checks all apps (release / debug) otherwise (release)
	schema.define('each', Boolean);   // notify for all or each app
	schema.define('isenabled', Boolean);

	schema.setQuery(function(error, options, callback) {

		if (options.page)
			options.page--;
		else
			options.page = 0;

		if (!options.max)
			options.max = 20;

		DB('alarms').find().make(function(filter) {

			filter.skip(options.page * options.max);
			filter.take(options.max);

			filter.callback(function(err, docs, count) {
				var data = {};
				data.count = count;
				data.items = docs;
				data.limit = options.max;
				data.pages = Math.ceil(data.count / options.max) || 1;
				data.page = options.page + 1;
				callback(data);
			});
		});
	});

	schema.setRemove(function(error, options, callback) {
		var db = DB('alarms');
		db.remove().where('id', options.id).callback(SUCCESS(callback));
		db.counter.remove(options.id);
	});

	schema.setSave(function(error, model, options, callback) {

		var db = DB('alarms');

		if (model.id) {
			model.dateupdated = F.datetime;
			db.modify(model).where('id', model.id).callback(SUCCESS(callback));
		} else {
			model.id = UID();
			model.datecreated = F.datetime;
			db.insert(model).callback(SUCCESS(callback));
		}

		setTimeout2('alarms', refresh, 2000);
	});

});

function refresh() {
	DB('alarms').find().callback(function(err, items) {

		var rules = [];

		items.forEach(function(item) {

			if (!item.isenabled)
				return;

			var builder = [];
			var format = [];

			item.rules.forEach(function(rule) {
				var toBytes = rule.path === 'current.hdd' || rule.path === 'current.memory';

				if (rule.path === 'analyzatoroutput') {
					format.push('(value.' + rule.path + ')');
					builder.push('value.' + rule.path + '===\'' + rule.type + '\'');
				} else {
					format.push('(value.' + rule.path + '?value.' + rule.path + (toBytes ? '.filesize()' : '.format(0)') + (rule.path === 'current.cpu' ? '+\'%\'' : toBytes ? '' : '+\'x\'') + ':\'...\')');
					builder.push('value.' + rule.path + rule.type + (toBytes ? (rule.value * 1024 * 1024) : rule.value));
				}
			});

			builder.length && rules.push({ id: item.id, each: item.each, debug: item.debug, delay: item.delay || '5 minutes', idapplication: item.idapplication, name: item.name, phone: item.phone, email: item.email, message: item.message, validate: SCRIPT('next({0})'.format(builder.join('&&'))), format: new Function('message', 'value', 'return message.format(value.url,{0})'.format(format.join(','))) });
		});


		F.global.RULES = rules;
	});
}

F.on('ready', refresh);