[![MIT License][license-image]][license-url]

[![Support](https://www.totaljs.com/img/button-support.png)](https://www.totaljs.com/support/) [![Donate](https://www.totaljs.com/img/button-donate.png)](https://www.totaljs.com/#make-a-donation)

# Installation

__License__: [MIT](license.txt). 

__SuperAdmin__ needs latest Total.js from NPM `+v2.0.1`. 

__IMPORTANT__
- SuperAdmin is running on port 9999 which can be changed in `run.sh` script in `/www/superadmin/run.sh`
- SuperAdmin is auto-generating port numbers for new applications starting from `8000`. So for 100 apps you need to make sure ports `8000-8099` are free.

__VERY IMPORTANT__: SuperAdmin must be run as `root`

__To install SuperAdmin run commands bellow__
- run `sudo wget https://raw.githubusercontent.com/totaljs/superadmin/master/install.sh`
- run `sudo bash install.sh`
- login __user:__ `admin`, __password:__ `admin` (credentials are stored in `/www/superadmin/config`)

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

## Contributors

- Peter Širka <petersirka@gmail.com>
- Martin Smola  <smola.martin@gmail.com>
- Athul B Raj <https://github.com/Athuli7>

[license-image]: https://img.shields.io/badge/license-MIT-blue.svg?style=flat
[license-url]: license.txt
