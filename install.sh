RED='\033[0;31m'
NC='\033[0m' # No Color
printf "${RED}SuperAdmin Installtion${NC}\n"
echo "Installion assumes a clean install of Ubuntu 16.04"
echo "Installion prompts are for creating a subdomain 'superadmin for a domain name 'domain.tld' and accessing superadmin via it"
echo "you wil be prompted to provide both."
echo "By default, a cer-key pair is generated using OpenSSL for HTTPS, if HTTPS is enabled"
echo "You can find the cer-key pair in the /etc/ssl/<domain>/ folder."
echo "You will be promted to enter details for the certificate"
echo "SuperAdmin uses these commands: lsof, ps, netstat, du, cat, free, df, tail, last, ifconfig, uptime, tar"

# Root check
if [[ $EUID -ne 0 ]]; then
    printf "${RED}You must be a root user${NC}" 2>&1
    exit 1
fi

#User Consent
printf "${RED}This setup requires the installation of the Nginx, Node.js and GraphicsMagick packages using apt-get!${NC}\n"
read -p "Do you wish to permit this ? (y/n) : " userConsent

if [ "$userConsent" == "y" ]; then
    read -p "Do you want to provide SuperAdmin via HTTP? (y/n) : " httpEn
    read -p "Do you want to provide SuperAdmin via HTTPS? (y/n) : " httpsEn

    #User Input
    read -p "Domain without protocol (e.g. domain.tk): " domain
    read -p "Subdomain without protocol (e.g. superadmin): " subdomain

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

    #Key Generation

    mkdir /etc/ssl/${domain}
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -subj "/C=$certC/ST=$certST/L=$certL/O=$certO/OU=$certOU/CN=$subdomain.$domain" \
    -keyout /etc/ssl/${domain}/${subdomain}.key \
    -out /etc/ssl/${domain}/${subdomain}.cer

    #Configuration
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
    read -p "Which user should SuperAdmin use to run your applications ? (default root) : " user
    if id "$user" >/dev/null 2>&1; then
        printf "Using user -> %s\n" "$user"
        uid=$(id -u ${user})
        gid=$(id -g ${user})
        echo "$user:$uid:$gid" >> /www/superadmin/user.guid
    else
        printf "User %s does not exist. Using root instead.\n" "$user"
        echo "root:0:0" >> /www/superadmin/user.guid
    fi

    read -p "Do you wish to install cron job to start SuperAdmin automaticly after server restart? (y/n) :" autorestart
    if [ "$autorestart" == "y" ]; then
        #write out current crontab
        crontab -l > mycron
        #check cron job exists if not add it
        crontab -l | grep '@reboot /bin/bash /www/superadmin/run.sh' || echo '@reboot /bin/bash /www/superadmin/run.sh' >> mycron
        crontab mycron
        rm mycron
        echo "Cron job added."
    fi

    #Starting
    /bin/bash /www/superadmin/run.sh

else
    echo "Sorry, this installation cannot continue."
fi