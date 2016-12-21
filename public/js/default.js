var common = {};

// Current page
common.page = '';

// Current form
common.form = '';

$(document).ready(function() {
	jR.clientside('.jrouting');
	FIND('loading', FN('() => this.hide(500)'));
	$('.mainmenu-logo').on('click', function() {
		jR.redirect('/');
	});
});

// Because of login form
if (window.su) {
	jR.route('/', function() {
		SET('common.page', 'applications');
	});
}

jR.on('location', function(url) {
	var nav = $('header nav');
	nav.find('.selected').removeClass('selected');
	nav.find('a[href="' + url + '"]').addClass('selected');
	$('header nav').removeClass('mainmenu-visible');
});

function success() {
	var el = $('#success');
	el.show();
	el.addClass('success-animation');
	setTimeout(function() {
		el.removeClass('success-animation');
		setTimeout(function() {
			el.hide();
		}, 1000);
	}, 1500);
	FIND('loading').hide(500);
}

function can(name) {
	return su.roles.length ? su.roles.indexOf(name) !== -1 : true;
}

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


function mainmenu() {
	$('header nav').toggleClass('mainmenu-visible');
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