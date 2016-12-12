#!/bin/bash

if [[ "$@" == *"-renew"* ]]
then
	/root/.acme.sh/acme.sh --certhome /www/ssl --issue -d $1 --renew --force -w /www/acme
else
	if [[ "$@" == *"-update"* ]]
	then
		/root/.acme.sh/acme.sh upgrade
	else
		/root/.acme.sh/acme.sh --certhome /www/ssl --issue -d $1 -w /www/acme
	fi
fi