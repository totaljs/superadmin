Thelpers.app_uptime = function(value) {
	if (value) {
		var arr = value.split('-');
		return arr.length === 1 ? arr[0] : '<span class="time">{0}</span>'.format(arr[0].parseInt().pluralize('# days', '# day', '# days', '# days'));
	} else
		return DEF.empty;
};

Thelpers.domain = function(val) {
	return val.substring(val.indexOf('/') + 2);
};

Thelpers.filesize = function(value, decimals, type) {
	return value ? value.filesize(decimals, type) : '...';
};

Number.prototype.filesize = function(decimals, type) {

	if (typeof(decimals) === 'string') {
		var tmp = type;
		type = decimals;
		decimals = tmp;
	}

	var value;
	var t = this;

	// this === bytes
	switch (type) {
		case 'bytes':
			value = t;
			break;
		case 'KB':
			value = t / 1024;
			break;
		case 'MB':
			value = filesizehelper(t, 2);
			break;
		case 'GB':
			value = filesizehelper(t, 3);
			break;
		case 'TB':
			value = filesizehelper(t, 4);
			break;
		default:

			type = 'bytes';
			value = t;

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
	return (decimals === undefined ? value.format(1) : value.format(decimals)) + type;
};

function filesizehelper(number, count) {
	while (count--) {
		number = number / 1024;
		if (number.toFixed(3) === '0.000')
			return 0;
	}
	return number;
}

Thelpers.app_trending = function(val, type) {

	var key = this.path.substring(9);
	var obj = W.appsinfo[key];
	if (!obj)
		return DEF.empty;

	key += '_' + type;

	var prev = W.apps.trending[key];
	var curr = obj[type];

	W.apps.trending[key] = curr;

	if (type === 'connections')
		val = '<span>' + val + '</span>';

	if (prev == null)
		return val;

	var plus = '';

	if (prev < curr)
		plus = '<i class="fas fa-long-arrow-down green trending"></i>';
	else if (prev > curr)
		plus = '<i class="fas fa-long-arrow-up red trending"></i>';

	return plus + val;
};

Thelpers.uptime = function(value) {
	// value === seconds
	var minutes = (value / 60);
	var hours = (minutes / 60);
	var days = hours / 24;
	return days ? Math.round(days).pluralize('# days', '# day', '# days', '# days') : hours.padLeft(2) + ':' + minutes.padLeft(2);
};

Thelpers.counter = function(value) {
	if (value > 999999)
		return (value / 1000000).format(2) + ' M';
	if (value > 9999)
		return (value / 10000).format(2) + ' K';
	return value.format(0);
};

Thelpers.indexer = function(index) {
	return index + 1;
};

Thelpers.checkbox = function(val) {
	return '<i class="far ' + (val ? 'fa-check-square green' : 'fa-square') + '"></i>';
};

Thelpers.progress = function(val) {

	if (!val)
		val = 0;

	var color = val < 30 ? '#68B25B' : val < 50 ? '#CCCB41' : val < 70 ? '#EC8632' : '#E73323';
	return '<div class="tprogress"><div style="width:{0}%;background:{1}"></div></div>'.format(val, color);
};