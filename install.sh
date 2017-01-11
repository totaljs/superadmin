echo ""
echo "==================================================="
echo -e "\e[41mSuperAdmin Installtion\e[0m"
echo "==================================================="
echo ""
echo -e "\e[90mInstallation assumes a clean installation of Ubuntu Server +16\e[0m"
echo ""
echo -e "\e[100m-->\e[0m Installation prompts are for creating URL for SuperAdmin."
echo -e "\e[100m-->\e[0m By default, a cer-key pair is generated using OpenSSL for HTTPS, if HTTPS is enabled."
echo -e "\e[100m-->\e[0m You can find the cer-key pair in the /etc/ssl/<domain>/ folder."
echo -e "\e[100m-->\e[0m You will be promted to enter details for the certificate."
echo -e "\e[100m-->\e[0m \e[90mThis installation installs: Nginx, Node.js, GraphicsMagick and Git.\e[0m"

# Root check
if [[ $EUID -ne 0 ]]; then
    echo -e "\e[91mYou must be a root user.\e[0m" 2>&1
    exit 1
fi

# User Consent
echo ""
read -p $'Do you wish to permit this? \e[104m(y/n)\e[0m : ' userConsent

if [ "$userConsent" == "y" ]; then

    read -p $'Do you want to provide SuperAdmin via HTTPS? \e[104m(y/n)\e[0m : ' httpsEn
    echo ""

    if [ "$httpsEn" == "n" ]; then
        httpEn="y"
    fi

    #User Input
    read -p $'Top domain name without protocol (e.g. \e[100myourdomain.com\e[0m): ' domain
    read -p $'Subdomain name (e.g. \e[100msuperadmin\e[0m): ' subdomain

    echo ""
    echo "---------------------------------------------------"
    echo -e "SuperAdmin URL address will be:"

    if [ "$httpsEn" == "y" ]; then
        echo -e "\e[44mhttps://$subdomain.$domain\e[0m"
    else
        echo -e "\e[44mhttp://$subdomain.$domain\e[0m"
    fi
    echo "---------------------------------------------------"
    echo ""

    read -p $'Are you sure you want to continue? \e[104m(y/n)\e[0m : ' next

    if [ "$next" == "n" ]; then
        exit 1;
    fi

    if [ "$httpsEn" == "y" ]; then
        read -p "Country Name (2 letter code) (e.g. IN): " certC
        read -p "State or Province Name (e.g. Kerala): " certST
        read -p "Locality Name (e.g. Kochi): " certL
        read -p "Organization Name (e.g. Novocorp Industries Inc): " certO
        read -p "Organizational Unit Name (e.g. IT department): " certOU
    fi

    #Prerequisits
    apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
    apt-get install python-software-properties
    apt-get install software-properties-common
    curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
    apt-get update
    apt-get install -y nginx
    apt-get install -y nodejs
    apt-get install -y graphicsmagick
    curl https://get.acme.sh | sh
    mkdir /www/
    mkdir /www/logs/
    mkdir /www/nginx/
    mkdir /www/acme/
    mkdir /www/ssl/
    mkdir /www/www/
    mkdir /www/node_modules/
    cd /www/
    npm install total.js

    # Key Generation
    mkdir /etc/ssl/${domain}
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -subj "/C=$certC/ST=$certST/L=$certL/O=$certO/OU=$certOU/CN=$subdomain.$domain" \
    -keyout /etc/ssl/${domain}/${subdomain}.key \
    -out /etc/ssl/${domain}/${subdomain}.cer

    # Configuration
    cd
    apt-get install -y git
    git clone https://github.com/totaljs/superadmin
    mv superadmin /www/
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup
    cp /www/superadmin/nginx.conf /etc/nginx/nginx.conf
    cp /www/superadmin/superadmin.conf /www/nginx/
    repexp=s/#domain#/$domain/g
    subrepexp=s/#subdomain#/$subdomain/g
    httpenexp=s/#disablehttp#//g
    httpsenexp=s/#disablehttps#//g

    if [ "$httpEn" == "y" ]; then
        sed -i -e $httpenexp /www/nginx/superadmin.conf
    fi
    if [ "$httpsEn" == "y" ]; then
        sed -i -e $httpsenexp /www/nginx/superadmin.conf
    fi

    sed -i -e $repexp /www/nginx/superadmin.conf
    sed -i -e $subrepexp /www/nginx/superadmin.conf
    service nginx reload

    rm /www/superadmin/user.guid
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
        #write out current crontab
        crontab -l > mycron
        #check cron job exists if not add it
        crontab -l | grep '@reboot /bin/bash /www/superadmin/run.sh' || echo '@reboot /bin/bash /www/superadmin/run.sh' >> mycron
        crontab mycron
        rm mycron
        echo "Cron job added."
    fi

    echo ""
    echo -e "\e[100m-->\e[0m SuperAdmin uses these commands:"
    echo "lsof, ps, netstat, du, cat, free, df, tail, last, ifconfig, uptime, tar, git, npm,"
    echo "wc, grep, cp, mkdir"
    echo ""

    # Starting
    echo -e "\e[42mSTARTING...\e[0m"
    /bin/bash /www/superadmin/run.sh

else
    echo -e "\e[41mSorry, this installation cannot continue.\e[0m"
fi