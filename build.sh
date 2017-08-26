rm -fr build/dist/
gulp build --modules=modules.json
mv build/dist/prebid.js build/dist/prebid.`date +"d%Y%m%d%s"`.js
open build/dist/
