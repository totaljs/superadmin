sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 7F0CEB10
sudo apt-get install python-software-properties
sudo apt-get install software-properties-common
curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
sudo apt-get update
sudo apt-get install nginx
sudo apt-get install -y nodejs
sudo apt-get install graphicsmagick
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