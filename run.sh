#!/bin/bash

SA_PID=$(lsof -i :9999 | grep "LISTEN" | awk {'print $2'})

start_superadmin() {
	echo "STARTING SUPERADMIN ON PORT 9999"
	cp /www/superadmin/logs/debug.log "/www/logs/superadmin_$(date +%FT%H%M).log" 2>/dev/null
	mkdir -p /www/superadmin/logs/
	/usr/bin/node --nouse-idle-notification --expose-gc /www/superadmin/index.js 9999 > /www/superadmin/logs/debug.log &
}

if [[ $SA_PID ]]
then
	echo "KILLING OLD INSTANCE OF SUPERADMIN"
	kill -9 $SA_PID
	start_superadmin
else
	echo "SUPERADMIN IS CURRENTLY NOT RUNNING."
	start_superadmin
	exit 1
fi
