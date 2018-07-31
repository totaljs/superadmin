/usr/bin/node --nouse-idle-notification --expose-gc /www/superadmin/release.js 9999 > /dev/stdout &
nginx -g "daemon off;"