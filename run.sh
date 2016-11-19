kill -9 $(lsof -i :9999 | grep "total" | awk {'print $2'}) > /dev/null
cp /www/superadmin/superadmin.log /www/superadmin/superadmin_$(date +%F_%R).log
/usr/bin/node --nouse-idle-notification --expose-gc --max_inlined_source_size=1200 /www/superadmin/debug.js 9999 1> /www/superadmin/superadmin.log 2> /www/superadmin/superadmin.err &