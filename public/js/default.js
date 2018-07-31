var common = {};

// Current layers
common.layer = [];

// Current page
common.page = '';

// Current form
common.form = '';

$(document).ready(function() {
	NAVIGATION.clientside('.jrouting');
	SETTER(true, 'loading', 'hide', 500);
	$('.mainmenu-logo').on('click', function() {
		REDIRECT('/');
	});
});

// Because of login form
if (window.su) {
	ROUTE('/', function() {
		SET('common.page', 'applications');
	});
	ROUTE('/alarms/', function() {
		SET('common.page', 'alarms');
	});
	ROUTE('/settings/', function() {
		SET('common.page', 'settings');
	});
	ROUTE('/stats/', function() {
		SET('common.page', 'stats');
	});
}

ON('location', function(url) {
	var nav = $('header nav');
	nav.find('.selected').rclass('selected');
	nav.find('a[href="' + url + '"]').aclass('selected');
	var el = $('header nav').rclass('mainmenu-visible-animate');
	setTimeout(function() {
		el.rclass('mainmenu-visible ');
	}, 500);
});

function success() {
	var el = $('#success');
	el.show();
	el.aclass('success-animation');
	setTimeout(function() {
		el.rclass('success-animation');
		setTimeout(function() {
			el.hide();
		}, 1000);
	}, 1500);
	FIND('loading').hide(500);
}

function can(name) {
	return su.roles.length ? su.roles.indexOf(name) !== -1 : true;
}

Tangular.register('strip', function(value) {
	return value ? value.replace(/\n/g, '. ') : '';
});

Tangular.register('default', function(value, def) {
	return value == null || value === '' ? def : value;
});

Tangular.register('indexer', function(index) {
	return index + 1;
});

Tangular.register('filesize', function(value, decimals, type) {
	return value ? value.filesize(decimals, type) : '...';
});

Tangular.register('uptime', function(value) {
	// value === seconds
	var minutes = (value / 60);
	var hours = (minutes / 60);
	var days = hours / 24;
	return days ? Math.round(days).pluralize('# days', '# day', '# days', '# days') : hours.padLeft(2) + ':' + minutes.padLeft(2);
});

function statsmenu(el) {
	$('.panelstats').tclass('panelstats-visible');
	el.parent().tclass('statsmenu-visible');
}

function mainmenu() {
	var c1 = 'mainmenu-visible';
	var c2 = 'mainmenu-visible-animate';
	var el = $('header nav').tclass(c1);
	if (el.hclass(c1)) {
		setTimeout(function() {
			el.aclass(c2);
		}, 50);
	} else
		el.rclass(c2);
}

Number.prototype.filesize = function(decimals, type) {

	if (typeof(decimals) === 'string') {
		var tmp = type;
		type = decimals;
		decimals = tmp;
	}

	var value;

	// this === bytes
	switch (type) {
		case 'bytes':
			value = this;
			break;
		case 'KB':
			value = this / 1024;
			break;
		case 'MB':
			value = filesizehelper(this, 2);
			break;
		case 'GB':
			value = filesizehelper(this, 3);
			break;
		case 'TB':
			value = filesizehelper(this, 4);
			break;
		default:

			type = 'bytes';
			value = this;

			if (value > 1023) {
				value = value / 1024;
				type = 'KB';
			}

			if (value > 1023) {
				value = value / 1024;
				type = 'MB';
			}

			if (value > 1023) {
				value = value / 1024;
				type = 'GB';
			}

			if (value > 1023) {
				value = value / 1024;
				type = 'TB';
			}

			break;
	}

	type = ' ' + type;
	return (decimals === undefined ? value.format(2).replace('.00', '') : value.format(decimals)) + type;
};

function filesizehelper(number, count) {
	while (count--) {
		number = number / 1024;
		if (number.toFixed(3) === '0.000')
			return 0;
	}
	return number;
}

Tangular.register('counter', function(value) {
	if (value > 999999)
		return (value / 1000000).format(2) + ' M';
	if (value > 9999)
		return (value / 10000).format(2) + ' K';
	return value.format(0);
});