rm -fr build/dist/
rm -fr node_modules
yarn install
gulp build --modules=adformBidAdapter,appnexusBidAdapter,criteoBidAdapter,improvedigitalBidAdapter,ixBidAdapter,openxBidAdapter,pubmaticBidAdapter,rubiconBidAdapter,widespaceBidAdapter
mv build/dist/prebid.js build/dist/prebid.`date +"d%Y%m%d%s"`.js
open build/dist/
