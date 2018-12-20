#!/bin/bash

SA_PID=$(lsof -i :9999 | grep "total" | awk {'print $2'})

start_superadmin() {
        echo "STARTING SUPERADMIN ON PORT 9999"
        cp /www/logs/superadmin.log "/www/logs/superadmin_$(date +%FT%H%M).log"
        /usr/bin/node --nouse-idle-notification --expose-gc /www/superadmin/release.js 9999 > /www/logs/superadmin.log &
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
