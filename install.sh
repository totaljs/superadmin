echo "SuperAdmin Installtion"
# Root check
if [[ $EUID -ne 0 ]]; then
  echo "You must be a root user" 2>&1
  exit 1
fi
echo "This setup requires the installation of the nginx, nodejs and graphicsmagick packages using apt-get"
echo "Do you wish to permit this ? (y/n)"
read userConsent
if [ "$userConsent" == "y" ]; then
apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
apt-get install python-software-properties
apt-get install software-properties-common
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
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
npm install total.js@beta
else
echo "Sorry, this installation cannot continue."
fi
