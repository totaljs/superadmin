# Installation

- __IMPORTANT__: superadmin must launched as `root`
- run `install.sh`
- copy `superadmin` to `/www/superadmin/`
- copy `superadmin/nginx.conf` to `/etc/nginx/nginx.conf` (yes, replace it)
- copy `superadmin/superadmin.conf` to `/www/nginx/`
- update `/www/nginx/superadmin.conf` by yourself
- reload nginx `service nginx reload`
- run superadmin via `bash /www/superadmin/run.sh`

