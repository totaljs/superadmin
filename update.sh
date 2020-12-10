cd /www/

echo "Install missing Linux packages"

apt-get install -y sysstat

echo "Install NPM dependencies"
npm install total4 2>/dev/null
npm install dbms 2>/dev/null

echo "Backing up old SuperAdmin: /www/superadmin_bk.zip"
zip -r superadmin_bk.zip superadmin 2>/dev/null

echo "Kills all running apps"
pkill -f total

mkdir superadmin_tmp
cp /www/superadmin/databases/applications.json /www/superadmin_tmp/applications.json
cp /www/superadmin/databases/stats.nosql /www/superadmin_tmp/stats.nosql
cp /www/superadmin/databases/acmethumbprint.txt /www/superadmin_tmp/acmethumbprint.txt

SA_PID=$(lsof -i :9999 | grep "LISTEN" | awk {'print $2'})

if [[ $SA_PID ]]
then
	echo "Killing old instance of SuperAdmin"
	kill -9 $SA_PID
fi

rm -rf /www/superadmin/
mkdir -p /www/superadmin/logs/

cd /www/superadmin/
echo "Downloading of new version of SuperAdmin"
wget "https://raw.githubusercontent.com/totaljs/superadmin_templates/main/superadmin.zip" 2>/dev/null
unzip superadmin.zip
rm superadmin.zip

mkdir databases
cp /www/superadmin_tmp/applications.json /www/superadmin/databases/applications.json
cp /www/superadmin_tmp/stats.nosql /www/superadmin/databases/stats.nosql
cp /www/superadmin_tmp/acmethumbprint.txt /www/superadmin/databases/acmethumbprint.txt

echo "Running..."
bash run.sh

echo "Done!"