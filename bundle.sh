mkdir -p .bundle

cd .bundle
cp -a ../controllers/ controllers
cp -a ../definitions/ definitions
cp -a ../public/ public
cp -a ../private/ private
cp -a ../schemas/ schemas
cp -a ../resources/ resources
cp -a ../tasks/ tasks
cp -a ../views/ views

# cd ..
total4 --bundle superadmin.bundle
mv superadmin.bundle ../superadmin.bundle

cd ..
rm -rf .bundle
echo "DONE"