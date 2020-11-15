name="/www/ssl/superadmin"
commonname=superadmin
country=XX
state=Earth
locality=World
organization=Total
organizationalunit=IT
email=support@totaljs.com

sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout $name.key -out $name.csr -subj "/C=$country/ST=$state/L=$locality/O=$organization/OU=$organizationalunit/CN=$commonname/emailAddress=$email"