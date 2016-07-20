#!/bin/bash

if [ "$2" == "--www" ] || [ "$2" == "www" ] || [ "$1" == "-www" ]
then
	/root/.acme.sh/acme.sh --certhome /www/ssl --issue -d $1 --issue -d www.$1 -w /www/acme
	exit
fi

/root/.acme.sh/acme.sh --certhome /www/ssl --issue -d $1 -w /www/acme