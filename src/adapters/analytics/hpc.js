import {ajax} from 'src/ajax';
import adapter from 'AnalyticsAdapter';
import CONSTANTS from 'src/constants.json';

const utils = require('../../utils');

const url = 'https://api.bitgn.com/hpc?t=8e186e7f-1dd6-4b35-9846-05882a441bc0';
const analyticsType = 'endpoint';

let auctionInitConst = CONSTANTS.EVENTS.AUCTION_INIT;
let auctionEndConst = CONSTANTS.EVENTS.AUCTION_END;
let bidWonConst = CONSTANTS.EVENTS.BID_WON;

let initOptions = {gender: null, age: null, id: null, shard: null};
let bidWon = {options: {}, events: []};
let eventStack = {options: {}, events: []};

let auctionStatus = 'not_started';

function checkOptions() {
  return initOptions.shard !== null;
}

function buildBidWon(eventType, args) {
  bidWon.options = initOptions;
  bidWon.events = [{args: args, eventType: eventType}];
}

function buildEventStack() {
  eventStack.options = initOptions;
}

function send(eventType, data, sendDataType) {
  let fullUrl = url + '&gender=' + initOptions.gender + '&age=' + initOptions.age + '&id=' + initOptions.id + '&shard=' + initOptions.shard;

  ajax(
    fullUrl,
    (result) => utils.logInfo('Event ' + eventType + ' sent ' + sendDataType + ' to hpc analytic with result' + result),
    JSON.stringify(data)
  );
}

function pushEvent(eventType, args) {
  eventStack.events.push({eventType, args});
}

function flushEvents() {
  eventStack.events = [];
}

let hpcAdapter = Object.assign(adapter({url, analyticsType}),
  {
    track({eventType, args}) {
      if (!checkOptions()) {
        return;
      }

      let info = Object.assign({}, args);

      if (info && info.ad) {
        info.ad = '';
      }

      if (eventType === auctionInitConst) {
        auctionStatus = 'started';
        flushEvents();
      }

      if ((eventType === bidWonConst) && auctionStatus === 'not_started') {
        buildBidWon(eventType, info);
        send(eventType, bidWon, 'bidWon');
        return;
      }

      if (eventType === auctionEndConst) {
        buildEventStack(eventType);
        send(eventType, eventStack, 'eventStack');
        flushEvents();
        auctionStatus = 'not_started';
      } else {
        pushEvent(eventType, info);
      }
    }
  });

hpcAdapter.originEnableAnalytics = hpcAdapter.enableAnalytics;

hpcAdapter.enableAnalytics = function (config) {
  initOptions = config.options;
  utils.logInfo('HPC Analytics enabled with config', initOptions);
  hpcAdapter.originEnableAnalytics(config);
};

export default hpcAdapter;
