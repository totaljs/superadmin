[![MIT License][license-image]][license-url]

[![Support](https://www.totaljs.com/img/button-support.png?v=2)](https://www.totaljs.com/support/)

# Installation

- __SuperAdmin__ (v5.0.0) needs latest Total.js from NPM `+v2.3.0`
- __License__: [MIT](license.txt)
- [__HelpDesk with professional support__](https://helpdesk.totaljs.com)

__IMPORTANT__
- SuperAdmin is running on port 9999 which can be changed in `run.sh` script in `/www/superadmin/run.sh`
- SuperAdmin is auto-generating port numbers for new applications starting from `8000`. So for 100 apps you need to make sure ports `8000-8099` are free.
- SuperAdmin __must be run__ as `root`

__Install requirements:__
- `curl`
- `openssl`

__SuperAdmin requirements:__
- `bash`
- `lsof`
- `ps`
- `netstat`
- `ifconfig`
- `uptime`
- `grep`
- `awk`
- `wc`
- `du`
- `cat`
- `free`
- `df`
- `tail`
- `last`
- `tar`
- `cp`
- `mkdir`
- `npm`

__To install SuperAdmin run commands bellow:__

```bash
$ sudo wget https://raw.githubusercontent.com/totaljs/superadmin/master/install.sh && bash install.sh
```

- login __user:__ `admin`, __password:__ `admin` (credentials are stored in `/www/superadmin/config`)
- manually run (if you didn't register cron in the installation) `$ cd /www/superadmin/` and `$ bash run.sh`


---

## How do I translate SuperAdmin?

- install Total.js as global module `npm install -g total.js`
- then open SuperAdmin directory `cd superadmin`
- then perform this command `totaljs --translate`
- translate translated file `translate.resource`
- and copy the content to `/resources/default.resource`
- run app

---

## Where does SuperAdmin store data?

All data are stored in `/superadmin/databases/` directory. Applications are stored in `application.json`.

---

## How to upload my application?

__SuperAdmin__ uses a Total.js package mechanism. The mechanism creates a package file with a complete directory structure and all files.

- first you have to install Total.js framework as a global module `$ npm install -g total.js`
- then perform a command below:

```bash
$ cd myapplication
$ tpm create myapp.package
```

- `tpm` creates a package file
- and this file you can upload via SuperAdmin

![Upload a new application](https://www.totaljs.com/img/superadmin-upload.png)

---

## How to upgrade my older SuperAdmin version?

Don't worry, it's very easy.

- backup file `/databases/applications.json`
- backup your credentials in `/config` file (only credentials, nothing more)
- copy all directories and files from a new version of SuperAdmin to your server
- restore your backup file `/databases/applications.json`
- restore your credentials in `/config`
- you have to update `SSL generator` to latest version via `bash /www/superadmin/ssl.sh --update`
- restart SuperAdmin `bash run.sh`
- clear cache in your web browser

## Nice to know

Bash script `superadmin/ssl.sh` can create or renew certificate manually:

```bash
# CREATE:
$ bash ssl.sh superadmin.mydomain.com

# RENEW:
$ bash ssl.sh superadmin.mydomain.com --renew
```

## Uninstall SuperAdmin

- stop all apps in SuperAdmin
- kill SuperAdmin using this command `$ kill -9 $(lsof -i :9999 | grep "total" | awk {'print $2'}) > /dev/null`
- to replace nginx.conf with backed up file use this command `$ cp /etc/nginx/nginx.conf.backup /etc/`nginx/nginx.conf
- reload nginx service nginx reload and/or just stop it `$ service nginx stop`
- if you added a cron job to start apps at system startup then remove this line `@reboot /bin/bash /www/superadmin/run.sh` from crontab using `$ crontab -e` command
- remove `/www/` folder, this will remove all ssl certificates, nginx conf files, all applications, etc.
- to remove node.js run `$ apt-get remove -y nodejs`
- to remove nginx run `$ apt-get remove -y nginx`
- to remove graphicsmagick run `$ apt-get remove -y graphicsmagick`

## Contributors

- Peter Širka (author) <petersirka@gmail.com>
- Martin Smola (support)  <smola.martin@gmail.com>
- Athul B Raj <https://github.com/Athuli7>

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: license.txt
