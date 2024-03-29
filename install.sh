echo ""
echo "==================================================="
echo -e "\e[41mSuperAdmin Installation\e[0m"
echo "==================================================="
echo ""
echo -e "\e[90mInstallation assumes a clean installation of Ubuntu Server +16\e[0m"
echo ""
echo -e "\e[100m-->\e[0m Installation prompts are for creating URL for SuperAdmin."
echo -e "\e[100m-->\e[0m A domain for SuperAdmin has to be mapped to this server when you want to use SSL."
echo -e "\e[100m-->\e[0m \e[90mThis installation installs: Nginx, Node.js, GraphicsMagick and Git.\e[0m"

# Root check
if [[ $EUID -ne 0 ]]; then
	echo -e "\e[91mYou must be a root user.\e[0m" 2>&1
	exit 1
fi

# User Consent
echo ""
read -p $'Do you wish to permit this? \e[104m(y/n)\e[0m : ' userConsent

if [[ "$userConsent" == "y" || "$userConsent" == "Y" ]]; then

	read -p $'Do you want to provide SuperAdmin via HTTPS? \e[104m(y/n)\e[0m : ' httpsEn
	echo ""

	if [ "$httpsEn" == "n" ]; then
		httpEn="y"
	fi

	#User Input
	read -p $'Domain name without protocol (e.g. \e[100msuperadmin.yourdomain.com\e[0m): ' domain

	echo ""
	echo "---------------------------------------------------"
	echo -e "SuperAdmin URL address will be:"

	if [ "$httpsEn" == "y" ]; then
		echo -e "\e[44mhttps://$domain\e[0m"
	else
		echo -e "\e[44mhttp://$domain\e[0m"
	fi
	echo "---------------------------------------------------"
	echo ""

	read -p $'Are you sure you want to continue? \e[104m(y/n)\e[0m : ' next

	if [ "$next" == "n" ]; then
		exit 1;
	fi

	#Prerequisits
	apt-get install -y curl python-software-properties software-properties-common
	curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
	apt-get update
	apt-get install -y nginx
	apt-get install -y nodejs
	apt-get install -y graphicsmagick
	apt-get install -y zip
	apt-get install -y ftp
	apt-get install -y unzip
	apt-get install -y lsof
	apt-get install -y socat
	apt-get install -y sysstat
	curl https://get.acme.sh | sh
	/root/.acme.sh/acme.sh --set-default-ca --server letsencrypt
	mkdir /www/
	mkdir /www/logs/
	mkdir /www/nginx/
	mkdir /www/acme/
	mkdir /www/ssl/
	mkdir /www/www/
	mkdir /www/superadmin/
	mkdir /www/node_modules/
	cd /www/
	npm install total4
	npm install -g total4
	npm install total.js
	npm install -g total.js
	npm install dbms
	npm install pg

	# Configuration
	cd
	apt-get install -y git

	# Total.js downloads package and unpack
	cd /www/superadmin/
	wget "https://raw.githubusercontent.com/totaljs/superadmin_templates/main/superadmin.zip"
	unzip superadmin.zip
	rm superadmin.zip

	cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
	cp /www/superadmin/ffdhe2048.pem /etc/nginx/ffdhe2048.pem
	cp /www/superadmin/nginx.conf /etc/nginx/nginx.conf
	cp /www/superadmin/superadmin.conf /www/nginx/

	repexp=s/#domain#/$domain/g
	httpenexp=s/#disablehttp#//g
	httpsenexp=s/#disablehttps#//g

	if [ "$httpEn" == "y" ]; then
		sed -i -e $httpenexp /www/nginx/superadmin.conf
		sed -i -e $repexp /www/nginx/superadmin.conf
		nginx -s reload
	fi

	if [ "$httpsEn" == "y" ]; then

		echo "Generating SSL ..."

		sed -i -e $repexp /www/nginx/superadmin.conf
		sed -i -e $httpenexp /www/nginx/superadmin.conf
		nginx -s reload

		# Generates SSL
		bash /www/superadmin/ssl.sh $domain

		# Check if certificate was created successfully
		if [ -f "/www/ssl/$domain/fullchain.cer" ]; then

			# Copies NGINX configuration file again
			cp /www/superadmin/superadmin.conf /www/nginx/

			sed -i -e $httpsenexp /www/nginx/superadmin.conf
			sed -i -e $repexp /www/nginx/superadmin.conf
			nginx -s reload

			echo "Configured superadmin with https://$domain"
		else
			echo "Failed to generate SSL properly, try 'bash /www/superadmin/reconfigure.sh y $domain y' again later..." 2>&1
		fi

	fi

	rm /www/superadmin/user.guid
	echo ""
	echo "---------------------------------------------------"
	read -p $'Which user should SuperAdmin use to run your applications ? (default \e[104mroot\e[0m) : ' user
	if id "$user" >/dev/null 2>&1; then
		printf "Using user -> %s\n" "$user"
		uid=$(id -u ${user})
		gid=$(id -g ${user})
		echo "$user:$uid:$gid" >> /www/superadmin/user.guid
	else
		printf "User %s does not exist. Using root instead.\n" "$user"
		echo "root:0:0" >> /www/superadmin/user.guid
	fi

	read -p $'Do you wish to install cron job to start SuperAdmin automatically after server restarts? \e[104m(y/n)\e[0m :' autorestart

	if [ "$autorestart" == "y" ]; then

		# Writes out current crontab
		crontab -l > mycron

		# Checks a cron job exists if not add it

		crontab -l | grep '@reboot /bin/bash /www/superadmin/run.sh' || echo '@reboot /bin/bash /www/superadmin/run.sh' >> mycron
		crontab mycron
		rm mycron
		echo "Cron job added."
	fi

	service nginx start

	echo ""
	echo "---------------------------------------------------"
	echo -e "\e[100m--> SuperAdmin uses these commands:\e[0m"
	echo "lsof, ps, netstat, du, cat, free, df, tail, last, ifconfig, uptime, tar, git, npm,"
	echo "wc, grep, cp, mkdir"
	echo "---------------------------------------------------"
	echo ""

	# Starting
	echo -e "\e[42mSTARTING...\e[0m"
	/bin/bash /www/superadmin/run.sh

else
	echo -e "\e[41mSorry, this installation cannot continue.\e[0m"
fi