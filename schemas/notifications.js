NEWSCHEMA('Notifications', function(schema) {

	schema.setQuery(function($) {
		PREF.notifications && PREF.set('notifications', 0);
		NOSQL('notifications').find2().take(50).callback($.callback);
	});

	schema.setRemove(function($) {
		NOSQL('notifications').clear().callback($.done());
	});

});