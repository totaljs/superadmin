echo ""
echo "==================================================="
echo -e "\e[41mSuperAdmin Centos 7.3+ Installation\e[0m"
echo "==================================================="
echo ""

echo -e "\e[31mWARNING"
echo -e "\e[31mA clean installation of CentOS 7.3+ will work best."
echo -e "\e[31mYou may have issues installing on a server with Ngnix or Apache installed."
echo -e "\e[31mThis installation will overwite your nginx.conf file.  If you have Nginx installed, make a backup of this file.\e[0m"
echo ""
echo -e "\e[100m-->\e[0m This installation will map SuperAdmin to a domain."
echo -e "\e[100m-->\e[0m Please edit your DNS records accordingly before continuing."
echo -e "\e[100m-->\e[0m This installation installs the following dependencies:"
echo -e "\e[100m-->\e[0m Nginx Repository, EPEL Repository, Nginx, Node.js, GraphicsMagick, zip, ftp, unzip, curl, openssl, and Git.\e[0m"

echo ""
echo "---------------------------------------------------"
echo -e "\e[100m--> SuperAdmin uses these commands:\e[0m"
echo "lsof, ps, netstat, du, cat, free, df, tail, last, ifconfig, uptime, tar, git, npm,"
echo "wc, grep, cp, mkdir"
echo "---------------------------------------------------"
echo ""


# Root check
if [[ $EUID -ne 0 ]]; then
	echo -e "\e[91mYou must be a root user.\e[0m" 2>&1
	exit 1
fi

# User Consent
echo ""
read -p $'Do you agree to the installation? \e[104m(y/n)\e[0m : ' userConsent

if [ "$userConsent" == "y" ]; then

	read -p $'Do you want to provide SuperAdmin via HTTPS? \e[104m(y/n)\e[0m : ' httpsEn
	echo ""

	if [ "$httpsEn" == "n" ]; then
		httpEn="y"
	fi

	#User Input
	read -p $'Domain name without protocol (e.g. \e[100msuperadmin.yourdomain.com\e[0m): ' domain
         if [ "$domain" == "" ]; then
		echo -e "No domain entered.  A domain is required."
		  exit 1;

	fi
	echo ""
	echo "---------------------------------------------------"
	echo -e "Your SuperAdmin URL is:"

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
	yum install -y -q epel-release
	touch /etc/yum.repos.d/nginx.repo
	echo "[nginx]" >> /etc/yum.repos.d/nginx.repo
	echo "name=nginx repo" >> /etc/yum.repos.d/nginx.repo
	echo "baseurl=http://nginx.org/packages/centos/\$releasever/\$basearch/" >> /etc/yum.repos.d/nginx.repo
	echo "gpgcheck=0" >> /etc/yum.repos.d/nginx.repo
	echo "enabled=1" >> /etc/yum.repos.d/nginx.repo
	curl --silent --location https://rpm.nodesource.com/setup_8.x | bash -
	yum update -y -q
	yum install -y -q nodejs
	yum install -y -q nginx
	yum install -y -q graphicsmagick
	yum install -y -q zip
	yum install -y -q ftp
	yum install -y -q unzip
	yum install -y -q curl
	yum install -y -q openssl
	yum install -y -q git
	yum install -y -q lsof
	yum install -y -q socat
	curl https://get.acme.sh | sh
	mkdir /www/
	mkdir /www/logs/
	mkdir /www/nginx/
	mkdir /www/acme/
	mkdir /www/ssl/
	mkdir /www/www/
	mkdir /www/superadmin/
	mkdir /www/node_modules/
        touch /www/superadmin/superadmin.log
	cd /www/
	npm install total.js
	npm install -g total.js

	# Total.js downloads package and unpack
	cd /www/superadmin/
	tpm install "https://cdn.totaljs.com/2017xc9db052e/superadmin.package?ts=$(date +%s)"

	cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
	cp /www/superadmin/nginx.conf /etc/nginx/nginx.conf
	cp /www/superadmin/superadmin.conf /www/nginx/

	repexp=s/#domain#/$domain/g
	httpenexp=s/#disablehttp#//g
	httpsenexp=s/#disablehttps#//g

	if [ "$httpEn" == "y" ]; then
		sed -i -e $httpenexp /www/nginx/superadmin.conf
		sed -i -e $repexp /www/nginx/superadmin.conf
		systemctl start nginx
	fi

	if [ "$httpsEn" == "y" ]; then

		echo "Generating SSL ..."

		sed -i -e $repexp /www/nginx/superadmin.conf
		sed -i -e $httpenexp /www/nginx/superadmin.conf
		systemctl restart nginx

		# Generates SSL
		bash /www/superadmin/ssl.sh $domain

		# Copies NGINX configuration file again
		cp /www/superadmin/superadmin.conf /www/nginx/

		sed -i -e $httpsenexp /www/nginx/superadmin.conf
		sed -i -e $repexp /www/nginx/superadmin.conf
		systemctl restart nginx
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
	else
		echo -e "\e[31mTo Run Manually:  $ cd /www/superadmin/ && $ bash run.sh\e[0m"

	fi





	# Starting
	echo -e "\e[42mSTARTING SUPERADMIN...\e[0m"
	/bin/bash /www/superadmin/run.sh
	echo -e "Your SuperAdmin URL is: \e[44mhttps://$domain\e[0m"

else
	echo -e "\e[41mYou must agree to the installation to continue.\e[0m"
fi