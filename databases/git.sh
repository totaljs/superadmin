rm -rf $2/_gitclone/
git clone --depth=1 --branch=master $1 $2/_gitclone/ && rm -rf $2/_gitclone/.git/
cd "$2"
cp -r _gitclone/* $2
rm -rf $2/_gitclone/