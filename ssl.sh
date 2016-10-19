#!/bin/bash

if [[ "$@" == *"-renew"* ]]
then
	/root/.acme.sh/acme.sh --certhome /www/ssl --issue -d $1 --renew --force -w /www/acme
else
	/root/.acme.sh/acme.sh --certhome /www/ssl --issue -d $1 -w /www/acme
fi