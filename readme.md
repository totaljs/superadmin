# Installation

__SuperAdmin__ needs latest Total.js from NPM `+v2.0.1`.

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

## How do I to translate SuperAdmin?

- install Total.js as global module `npm install -g total.js`
- then open HelpDesk directory `cd helpdesk`
- then perform this command `totaljs --translate`
- translate translated file `translate.resource`
- and copy the content to `/resources/default.resource`
- run app