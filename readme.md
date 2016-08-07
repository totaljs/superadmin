[![MIT License][license-image]][license-url]

[![Support](https://www.totaljs.com/img/button-support.png)](https://www.totaljs.com/support/) [![Donate](https://www.totaljs.com/img/button-donate.png)](https://www.totaljs.com/#make-a-donation)

# Installation

__License__: [MIT](license.txt). __SuperAdmin__ needs latest Total.js from NPM `+v2.0.1`. __IMPORTANT__: All ports from `8000` must be free for SuperAdmin applications because __SuperAdmin__ uses auto-generating port numbers for new applications.

- __IMPORTANT__: superadmin must run as `root` (very important)
- run `sudo su` to change user to root
- run `apt-get install git` to install git
- run `git clone https://github.com/totaljs/superadmin` to clone the repository
- run `cd superadmin` to move into the directory
- run `bash install.sh` (Nginx, Node.js, GraphicsMagick, ACME, Total.js)
- run `mv ../superadmin /www/` to move the files to the right directory
- run `cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup` to backup the original file
- run `cp /www/superadmin/nginx.conf /etc/nginx/nginx.conf` to replace the current configuration file
- run `cp /www/superadmin/superadmin.conf /www/nginx/` to copy the vhost file
- run `nano /www/nginx/superadmin.conf` to update the configuration to your needs
- run `service nginx reload` to reload nginx
- run `bash /www/superadmin/run.sh` to start the superadmin
- login __user:__ `admin`, __password:__ `admin` (credentials are stored in `/www/superadmin/config`)

---

## How do I to translate SuperAdmin?

- install Total.js as global module `npm install -g total.js`
- then open HelpDesk directory `cd helpdesk`
- then perform this command `totaljs --translate`
- translate translated file `translate.resource`
- and copy the content to `/resources/default.resource`
- run app

---

## Where does SuperAdmin store data?

All data are stored in `/superadmin/databases/` directory. Applications are stored in `application.json`.

## Contributors

- Peter Širka <petersirka@gmail.com>
- Martin Smola  <smola.martin@gmail.com>
- Athul B Raj <https://github.com/Athuli7>

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: license.txt