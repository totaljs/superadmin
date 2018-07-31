FROM ubuntu:16.04

ENV domain=localhost

# Install Node.js 8 and npm 5
RUN apt-get update
RUN apt-get -qq update
RUN apt-get install -y build-essential
RUN apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash
RUN apt-get install -y nodejs

# Install SuperAdmin dependencies
RUN apt-get install -y nginx \
	graphicsmagick \
	zip \
	ftp \
	unzip \
	lsof \
	socat \
	git
RUN curl https://get.acme.sh | sh
RUN npm install -g total.js

RUN rm -rf /var/cache/apk/*

# Configure and copy SuperAdmin directory
WORKDIR /www
RUN mkdir /www/logs/
RUN mkdir /www/nginx/
RUN mkdir /www/acme/
RUN mkdir /www/ssl/
RUN mkdir /www/www/
RUN mkdir /www/superadmin/
RUN mkdir /www/node_modules/
RUN npm install total.js
ADD . /www/superadmin
RUN echo "root:0:0" >> /www/superadmin/user.guid

# Configure nginx
COPY nginx.conf /etc/nginx/nginx.conf
COPY superadmin.conf /www/nginx/
RUN sed -i s/#disablehttp#//g /www/nginx/superadmin.conf
RUN sed -i s/#domain#/$domain/g /www/nginx/superadmin.conf

EXPOSE 80 443 9999

CMD /www/superadmin/run-docker.sh

#BUILDING IT
#docker build -t superadmin:1.5 .

#RUN IT (you can also map any of the exposed ports above)
#docker run -p 8080:80 -it superadmin:1.5

#EXEC IT (access bash whilst it is running)
#docker exec -it a1ec4787d56b bash
