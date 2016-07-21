# Installation

- __IMPORTANT__: superadmin must run as `root`
- open terminal `$ sudo su`
- open `superadmin` directory in terminal `cd /www/superadmin/`
- run `install.sh` (Nginx, Node.js, GraphicsMagick, ACME, Total.js)
- copy `superadmin` to `/www/superadmin/`
- copy `superadmin/nginx.conf` to `/etc/nginx/nginx.conf` (yes, replace it)
- copy `superadmin/superadmin.conf` to `/www/nginx/`
- update `/www/nginx/superadmin.conf` by yourself
- reload nginx `service nginx reload`
- run superadmin via `bash /www/superadmin/run.sh`
- login __user:__ `admin`, __password:__ `admin` (credentials are stored in `superadmin/config`)
