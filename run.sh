kill -9 $(lsof -i :9999 | grep "total" | awk {'print $2'}) > /dev/null
node --nouse-idle-notification --expose-gc --max_inlined_source_size=1200 release.js 9999 > superadmin.log &