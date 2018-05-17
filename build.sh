rm -fr build/dist/
rm -fr node_modules
yarn install
gulp build --modules=modules.json
