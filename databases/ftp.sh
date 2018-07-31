HOST="$1"
USER="$2"
PASS="$3"
FROM="$4"
TO="$5"

ftp -p -inv $HOST << EOF
user $USER $PASS
put "$FROM" "/$TO"
bye
EOF