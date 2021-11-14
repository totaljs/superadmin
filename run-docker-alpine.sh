node --nouse-idle-notification --expose-gc /www/superadmin/index.js 9999 --release > /dev/stdout &
nginx -g "daemon off;"