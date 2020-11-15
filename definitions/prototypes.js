const REG_PROTOCOL = /^(http|https):\/\//gi;

// Tries to parse all domain names
String.prototype.superadmin_domains = function() {

	var t = this + '';
	var domain = t.split('.');
	if (domain.length === 3) {

		// www.totaljs.com
		// test.totaljs.com
		if (domain[0] === 'www') {
			domain.shift();
			return [t, domain.join('.')];
		}

	} else if (domain.length === 2) {
		// totaljs.com
		return [t, 'www.' + t];
	}

	return [t];
};

String.prototype.superadmin_url = function() {
	return this.replace(REG_PROTOCOL, '').replace(/\//g, '');
};

String.prototype.superadmin_nginxredirect = function() {
	return this.superadmin_redirect().replace(REG_PROTOCOL, '');
};

String.prototype.superadmin_redirect = function() {
	var end = this.substring(8);
	var index = end.indexOf('/');
	if (index !== -1)
		end = end.substring(0, index);
	return this.substring(0, 8) + end;
};

String.prototype.superadmin_linker = function(path) {
	var url = this.replace(REG_PROTOCOL, '').replace(/\//g, '');
	var arr = url.split('.');
	arr.reverse();
	var tmp = arr[1];
	arr[1] = arr[0];
	arr[0] = tmp;
	return arr.join('-').replace('-', '_') + (path ? path.replace(/\//g, '--').replace(/--$/g, '') : '');
};
