exports.install = function() {
	F.route('/*', 'index', ['authorize']);
	F.localize('/templates/*.html', ['compress']);
};