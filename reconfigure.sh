#!/bin/bash

# Reconfigures SuperAdmin from/to HTTPs

# $1 = SuperAdmin via HTTPS (y/n)
# $2 = Domain name without protocol (e.g. superadmin.yourdomain.com)
# $3 = Generate new SSL (y/n)

repexp=s/#domain#/$2/g
httpenexp=s/#disablehttp#//g
httpsenexp=s/#disablehttps#//g

cp /www/superadmin/superadmin.conf /www/nginx/

if [ "$1" == "n" ]; then
	sed -i -e $httpenexp /www/nginx/superadmin.conf
	sed -i -e $repexp /www/nginx/superadmin.conf
	nginx -s reload

	echo "Configured superadmin with http://$2"
else

	if [ "$3" == "y" ]; then
		# ensure it's not configured with ssl
		sed -i -e $repexp /www/nginx/superadmin.conf
		sed -i -e $httpenexp /www/nginx/superadmin.conf
		nginx -s reload

		# Generates SSL
		echo "Generating SSL ..."
		bash /www/superadmin/ssl.sh $2

	fi

	if [ -f "/www/ssl/$2/fullchain.cer" ]; then
		# copy it again to it's reconfigured with ssl
		cp /www/superadmin/superadmin.conf /www/nginx/
		
		sed -i -e $httpsenexp /www/nginx/superadmin.conf
		sed -i -e $repexp /www/nginx/superadmin.conf
		nginx -s reload

		echo "Configured superadmin with https://$2"
	else
		echo "Failed to reconfigure with HTTPS properly, '/www/ssl/$2/fullchain.cer' not found..." 2>&1
	fi
fi
			
/bin/bash /www/superadmin/run.sh