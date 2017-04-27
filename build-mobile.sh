rm -fr node_modules
npm install
rm -fr build/dist/prebid.*
gulp build --tag `date +"d%Y%m%d%s"` --adapters customAdapters.json --analyticsAdapters customAnalyticsAdapters.json
