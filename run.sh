kill -9 $(lsof -i :9999 | grep "total" | awk {'print $2'}) > /dev/null
cp /www/logs/superadmin.log "/www/logs/superadmin_$(date +%FT%H%M).log"
/usr/bin/node --nouse-idle-notification --expose-gc /www/superadmin/release.js 9999 > /www/logs/superadmin.log &
