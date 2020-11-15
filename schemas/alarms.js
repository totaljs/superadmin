NEWSCHEMA('AlarmRule', function(schema) {
	schema.define('name', 'String', true);
	schema.define('value', Object);
	schema.define('comparer', ['==', '!=', '<', '<=', '>', '>='], true);
});

NEWSCHEMA('Alarms', function(schema) {

	schema.define('id', UID);
	schema.define('appid', UID);
	schema.define('operator', ['or', 'and'])('or');
	schema.define('sysoperator', ['or', 'and'])('or');
	schema.define('name', 'String(50)', true);
	schema.define('type', ['apps', 'system']);
	schema.define('sysrules', '[AlarmRule]');
	schema.define('rules', '[AlarmRule]');
	schema.define('message', 'String(100)', true);
	schema.define('phone', '[Phone]');
	schema.define('email', '[Email]');
	schema.define('delay', 'String(30)');
	schema.define('highpriority', Boolean);
	schema.define('debug', Boolean);
	schema.define('each', Boolean);   // notify for all or each app
	schema.define('isenabled', Boolean);

	schema.setQuery(function($) {

		if (!$.user.sa) {
			$.invalid('401');
			return;
		}

		NOSQL('alarms').find().sort('datecreated_desc').callback($.callback);
	});

	schema.setRemove(function($) {

		if (!$.user.sa) {
			$.invalid('401');
			return;
		}

		NOSQL('alarms').remove().id($.id).callback($.done());
	});

	schema.setSave(function($, model) {

		if (!$.user.sa) {
			$.invalid('401');
			return;
		}

		var db = NOSQL('alarms');

		if (model.id) {
			model.dateupdated = NOW;
			db.modify(model).where('id', model.id).callback($.done());
		} else {
			model.id = UID();
			model.datecreated = NOW;
			db.insert(model).callback($.done());
		}

		setTimeout2('alarms', refresh, 2000);
	});

});

function refresh() {

	MAIN.rules = [];
	MAIN.sysrules = [];

	NOSQL('alarms').find().callback(function(err, items) {

		var rules = [];
		var sysrules = [];

		for (var i = 0; i < items.length; i++) {
			var item = items[i];
			if (item.isenabled) {

				var builder = [];
				var arr = item.type === 'apps' ? item.rules : item.sysrules;

				for (var j = 0; j < arr.length; j++) {
					var rule = arr[j];
					var toBytes = (/mem|hdd/i).test(rule.name);
					builder.push(rule.name + rule.comparer + (typeof(rule.value) === 'string' ? ('\'' + rule.value.replace(/[\s;.\-,"'`]+/g, '') + '\'') : (toBytes ? (rule.value * 1024 * 1024).floor(1) : rule.value)));
				}

				if (builder.length) {
					if (item.type === 'apps')
						rules.push({ id: item.id, each: item.each, debug: item.debug, delay: item.delay || '5 minutes', appid: item.appid, name: item.name, phone: item.phone, email: item.email, message: item.message, validate: new Function('app', 'return ' + builder.join(item.operator === 'and' ? '&&' : '||')) });
					else
						sysrules.push({ id: item.id, delay: item.delay || '5 minutes', name: item.name, phone: item.phone, email: item.email, message: item.message, validate: new Function('sys', 'return ' + builder.join(item.sysoperator === 'and' ? '&&' : '||')) });
				}

			}
		}

		MAIN.rules = rules;
		MAIN.sysrules = sysrules;
	});
}

ON('ready', refresh);