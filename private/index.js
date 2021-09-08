// ===================================================
// Total.js start script
// https://www.totaljs.com
// ===================================================

const total = '{{ value.total }}' || 'total4';
const options = {};

{{ if value.threads }}
options.threads = {{ value.threads }};
options.logs = 'isolated';
{{ fi }}

{{ if value.cluster }}
options.cluster = {{ value.cluster }};
{{ fi }}

{{ if !value.debug && value.watcher }}
options.watcher = true;
{{ fi }}

{{ if value.servicemode }}
options.servicemode = true;
{{ fi }}

{{ if value.editcode }}
options.edit = '{{ value.editcode }}';
{{ fi }}

{{ if value.unixsocket }}
options.unixsocket = '{{ value.unixsocket }}';
options.unixsocket777 = true;
{{ fi }}

var type = process.argv.indexOf('--release', 1) !== -1 || process.argv.indexOf('release', 1) !== -1 ? 'release' : 'debug';

if (total === 'total.js') {
	if (type === 'release')
		require(total).http('release', options);
	else
		require(total + '/debug')(options);
} else
	require(total + '/' + type)(options);