cd $1
tar --exclude="tmp/*" --exclude="dump/*" --exclude="*_backup.package" --exclude="*.tar" --exclude="*.tar.gz" --exclude=".git/*" --exclude="backups/*" -zcvf "$2" . > /dev/null