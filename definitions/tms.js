var notify = 'type:String,body:String,message:String,dtnotified:Date,dttms:Date';
var trigger = 'userid:String,username:String,ua:String,ip:String,dttms:Date';

NEWPUBLISH('apps_insert', 'Apps');
NEWPUBLISH('apps_update', 'Apps');
NEWPUBLISH('apps_remove', 'Apps');
NEWPUBLISH('apps_restart', 'Apps');
NEWPUBLISH('apps_restart_all', trigger);
NEWPUBLISH('apps_stop', 'Apps');
NEWPUBLISH('apps_stop_all', trigger);
NEWPUBLISH('apps_monitor', 'apps_monitor');
NEWPUBLISH('apps_analyzator', 'id:String,name:String,type:String,category:String,url:String,dterror:Date,dttms:Date');

NEWPUBLISH('notify_apps', notify);
NEWPUBLISH('notify_system', notify);

NEWPUBLISH('system_monitor', 'ip:String,uptime:Number,processes:Number,hddtotal:Number,hddused:Number,hddfree:Number,memtotal:Number,memused:Number,memfree:Number,dttms:Date');

// Helper
FUNC.tms = function($, data) {
	if (!data)
		return data;

	data.ua = $.ua;
	data.ip = $.ip;
	data.dttms = NOW;

	if ($.user) {
		data.userid = $.user.id;
		data.username = $.user.name;
	}

	return data;
};
