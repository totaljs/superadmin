mkdir -p .bundle

cd .bundle
cp -a ../controllers/ controllers
cp -a ../definitions/ definitions
cp -a ../public/ public
cp -a ../private/ private
cp -a ../jsonschemas/ jsonschemas
cp -a ../schemas/ schemas
cp -a ../plugins/ plugins
cp -a ../resources/ resources
cp -a ../tasks/ tasks
cp -a ../views/ views

# cd ..
total4 --bundle superadmin.bundle
mv superadmin.bundle ../--bundles--/app.bundle

cd ..
rm -rf .bundle
echo "DONE"