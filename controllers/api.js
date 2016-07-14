exports.install = function() {
	F.route('/api/applications/', json_query, ['*Application']);
	F.route('/api/applications/', json_applications_save,  ['post', '*Application']);
};

function json_query() {
	var self = this;
	self.$query(self.query, self.callback());
}

function json_save() {
	var self = this;
	self.$save(self.callback());
}

function json_applications_save() {
	var self = this;
	self.$async(self.callback(), 1).$workflow('port').$save().$workflow('nginx');
}