error-port           : The port uses another application.
error-url-exists     : URL exists in database.
error-url-noexist    : URL not exist in database
error-app-404        : Application doesn't exist.
error-app-linker     : You can change only protocol in the URL address.
error-app-master-404 : The master application doesn't exist.
error-template       : Template can't be downloaded.

// Total.js translation file
// Created: 2016-09-27 23:36

// public/index.html
T1656375912          : Thanks, you have been added.
T-1222226627         : Join our mailing list

// public/index.html, public/templates/applications-form-subprocess.html, public/templates/applications-form-upload.html, public/templates/applications-form.html
T-1838205928         : SUBMIT

// views/index.html, public/templates/applications-form-summary.html
T65203672            : Close

// views/index.html, public/templates/applications.html
T1101527363          : Applications

// views/index.html
T374429323           : Sign out

// views/login.html
T-785010297          : Enter your login name
T187470082           : Login name
T1758829696          : Enter your password
T1281629883          : Password
T-542111160          : Sign in
T-873912411          : Incorrect username or password.

// public/templates/applications-form-backup.html
T797140910           : Backuping...
T-1399633753         : <b>Please wait</b> for file saving dialog and don't do nothing. The browser waits for the backup file.
T1695877173          : I understand

// public/templates/applications-form-logs.html
T35924211            : Application's logs
T2374095             : Logs

// public/templates/applications-form-logs.html, public/templates/applications-form-subprocess.html, public/templates/applications-form-upload.html, public/templates/applications-form.html, public/templates/applications.html
T2011110042          : Cancel

// public/templates/applications-form-subprocess.html
T-1851904027         : Edit subprocess
T825322329           : When you add the subprocess then you have to upload it as <b>package</b> via <i class="fa fa-cloud-upload"></i> button in application's grid. The cluster doesn't work in <b>debug mode</b>.
T1595446404          : Choose existing application
T2480197             : Path
T-1351770627         : e.g. Processes data
T689187469           : The application must be optimized for the cluster. The cluster mode is enabled when the thread count is greater than <b>one thread</b>.

// public/templates/applications-form-subprocess.html, public/templates/applications-form.html
T-2045843904         : Enables debug mode
T2493601             : Port
T75456161            : Notes
T-1922394215         : Thread count
T-174688726          : Maximum count of request per second from a single IP
T-989174589          : This settings is a prevention for DDOS attacks. Nginx responds via 503 error for other requests.
T1538119564          : Maximum upload size (MB)
T298210041           : e.g. 129.34.33.33 and press enter
T1258067841          : Allowed IP addresses
T629622205           : Blocked IP addresses

// public/templates/applications-form-subprocess.html, public/templates/applications-form.html, public/templates/applications.html
T95458899            : debug

// public/templates/applications-form-subprocess.html, public/templates/applications-form-upload.html, public/templates/applications-form.html
T166698872           : Performs NPM install

// public/templates/applications-form-summary.html, public/templates/applications.html
T-192987258          : Summary
T-506506081          : Open connections

// public/templates/applications-form-summary.html
T249796867           : CPU consumption
T142384924           : Memory consumption
T1662241347          : HDD consumption
T868774209           : Open files

// public/templates/applications-form-upload.html
T-1288495918         : Upload a new application
T573789458           : <b>SuperAdmin</b> supports uploading packages. Is easy to create the package, just install Total.js as a global module, then open your application directory in the terminal and type <code>$ tpm create myapp.package</code>.
T1719798526          : Select template
T-336101236          : Browse device
T700976883           : Filename:
T512277563           : Removes all files in application directory
T-1217032675         : When is this option checked then SuperAdmin removes all <i class="fa fa-trash nmr"></i> files before unpacking package.
T376907615           : Are you sure you want to unpack uploaded package?

// public/templates/applications-form-upload.html, public/templates/applications.html
T88775               : Yes

// public/templates/applications-form.html
T-264919974          : Edit application
T1326504340          : When you add the application then you have to upload it as <b>package</b> via <i class="fa fa-cloud-upload"></i> button in application's grid.
T1803797027          : URL address
T1315364970          : The URL address must contain the protocol <code>http</code> or <code>https</code>.
T949122880           : security
T-1519510078         : SSL configuration
T20933181            : Type a path if you want to prevent <b>auto configure</b>.
T-70298187           : auto configure
T-1199139285         : SSL key
T-1769624221         : SSL certificate
T127527093           : Renew the certificate
T353637705           : Categorization
T-697912365          : Existing category
T-1030766925         : e.g. E-commerce
T115155230           : Category
T203822157           : e.g. Hosting ends january 2029
T-1010653303         : The application must be optimized for the cluster. The cluster mode is enabled when the thread count is greater than <b>one thread</b>. The cluster doesn't work in <b>debug mode</b>.
T-1727574955         : Process priority
T-53544870           : Process with highest priority is executed as first.
T286155448           : Delay (ms)
T-15891273           : Delay before executing the process. Other requests will wait.
T-203478704          : Relative URL address for monitoring
T-815945638          : If you use Total.js <b>monitor</b> module then add its relative URL address.
T610640459           : e.g. www.totaljs.com and press enter
T-636327999          : Custom NGINX configuration

// public/templates/applications-form.html, public/templates/applications.html
T-581688329          : Redirects

// public/templates/applications.html
T1875941103          : Type a word
T-917550981          : Search applications
T-1990199247         : Add application
T1417577774          : Add subprocess
T-1825002512         : Restart all
T1777901731          : Stop all
T1477319156          : Reconfigure all
T-1216152880         : Backup the server
T-781801262          : Online visitors
T1364918244          : Today visitors
T1712481035          : Current month requests
T-488626803          : Previous month requests
T1680500160          : Current year requests
T-1992733954         : Previous year requests
T2084199307          : Errors
T-2009220654         : Count of monitoring apps
T42225874            : Show logs
T-1532807697         : Restart
T2587682             : Stop
T1823217991          : Upload package
T1499275331          : Settings
T1584062294          : Backup as package
T-1850743644         : Remove
T-1993889503         : Memory
T80997156            : Total
T2198156             : Free
T2645981             : Used
T65298671            : Count
T71368               : HDD
T-786828786          : Network
T-1394060206         : MongoDB
T66952               : CPU
T2016261304          : Version
T-112048300          : PostgreSQL
T74798178            : MySQL
T78837083            : Redis
T1134675942          : CPU utilization (all cores)
T75207546            : Nginx
T-515912555          : Node.js
T1871616745          : GraphicsMagick
T-328612892          : Requests
T697055608           : Dynamic content
T31319653            : Static files
T982065527           : Pending
T-1073207300         : Desktop
T-1984987966         : Mobile
T86882               : XHR
T70454               : GET
T2461856             : POST
T79599               : PUT
T2012838315          : DELETE
T2213344             : HEAD
T1438009970          : Uploads
T43881522            : Responses
T82651726            : Views
T2286824             : JSON
T-828098132          : Websockets
T-59831914           : Not modified
T-304237063          : Destroyed
T-1144052262         : 400: bad request
T41738127            : 401: unauthorized
T1669075799          : 404: not found
T811461055           : 408: timeout
T-957941969          : 439: too large
T-1461667200         : 500: internal error
T1649327589          : Visitors
T1892688148          : Unique visitors
T-566624178          : Unique per month
T2249568             : Hits
T-1347655185         : Pages per visitor
T-295064580          : Direct visitors
T-967739592          : Social networks
T-578685927          : Search engines
T1956862964          : Advert
T-1841836183         : Robots
T1164829567          : Mobile devices
T1575642361          : Current month
T1813604407          : Previous month
T1575195300          : Current year
T474492838           : Previous year
T-433420311          : Are you sure you want to remove this application?
T-277725174          : Are you sure you want to create a backup of the whole server?
T-290260840          : Are you sure you want to restart all applications?
T-1486485092         : Are you sure you want to reconfigure all applications?
T-370695949          : Are you sure you want to stop all applications?
T-1539876835         : <b class="red">The certificate is expired</b> for domain <a href="{0}" target="_blank">{0}</a>, you have to renew it.
T-2092289507         : <b>The certificate will expire</b> for domain <a href="{0}" target="_blank">{0}</a> in short time, you have to renew it.
T-830629437          : OFFLINE
T1198536340          : The application <a href="{0}" target="_blank">{0}</a> <b class="red">contains errors</b>.