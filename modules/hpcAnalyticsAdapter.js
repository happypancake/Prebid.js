import { ajax } from 'src/ajax';
import adapter from 'src/AnalyticsAdapter';
import adaptermanager from 'src/adaptermanager';
import * as utils from 'src/utils';

import CONSTANTS from 'src/constants.json';

const url = 'https://api.bitgn.com/hpc?t=8e186e7f-1dd6-4b35-9846-05882a441bc0';
const analyticsType = 'endpoint';

const AUCTION_INIT = CONSTANTS.EVENTS.AUCTION_INIT;
const AUCTION_END = CONSTANTS.EVENTS.AUCTION_END;
const BID_REQUESTED = CONSTANTS.EVENTS.BID_REQUESTED;
const BID_TIMEOUT = CONSTANTS.EVENTS.BID_TIMEOUT;
const BID_RESPONSE = CONSTANTS.EVENTS.BID_RESPONSE;
const BID_WON = CONSTANTS.EVENTS.BID_WON;
const BID_ADJUSTMENT = CONSTANTS.EVENTS.BID_ADJUSTMENT;

let initOptions = { gender: null, age: null, id: null, shard: null, experiment: null };
let eventStack = { auction: {}, results: [] };

function checkOptions() {
  return initOptions.shard !== null;
}

function getPayload() {
  let tempStack = {
    auction: initOptions,
    results: {}
  };

  for (let event of eventStack.events) {

    // this happens once per auction
    if (event.eventType === AUCTION_INIT) {
      const init = event;
      tempStack.auction.timeout = init.args.timeout;
    }

    // this happens once per bidderCode
    if (event.eventType === BID_REQUESTED) {
      const request = event;

      for (let placement of event.args.bids) {
        const bidderPlacement = `${placement.bidder}_${placement.placementCode}`;

        let tempResult = {
          bidder: placement.bidder,
          placement: placement.placementCode,
          status: 'requested',
          cpm: 0
        };

        tempStack.results[bidderPlacement] = tempResult;
      }
    }

    // this can happen i many variations
    if (event.eventType === BID_RESPONSE) {
      const response = event;
      const bidderPlacement = `${response.args.bidderCode}_${response.args.adUnitCode}`;
      const responseIsEmpty = response.args.cpm === 0;

      let tempResult = tempStack.results[bidderPlacement];

      // we can only apply a empty to a requested, otherwise we will overwrite a response
      if (tempResult.status === 'requested' && responseIsEmpty) {
        tempResult.status = 'empty';
        tempResult.timeToRespond = response.args.timeToRespond;
      } else if (((tempResult.status === 'requested' || tempResult.status === 'empty') || response.args.cpm > tempResult.cpm) && !responseIsEmpty) {
        tempResult.status = 'responded';
        tempResult.cpm = response.args.cpm;
        tempResult.timeToRespond = response.args.timeToRespond;
        tempResult.size = `${response.args.width}x${response.args.height}`;
        tempResult.adServerPressure = response.args.adserverTargeting.hp_pressure
      }

      tempStack.results[bidderPlacement] = tempResult;
    }

    if (event.eventType === AUCTION_END) {

    }

    if (event.eventType === BID_TIMEOUT) {
      const timeout = event;

      for (let bidderCode of event.args) {
        for (let key in tempStack.results) {
          var result = tempStack.results[key];
          if (result.bidder === bidderCode) {
            const bidderPlacement = `${result.bidder}_${result.placement}`;
            result.status = 'timedout';
            tempStack.results[bidderPlacement] = result;
          }
        }
      }
    }

    if (event.eventType === BID_WON) {
      const win = event;
      const bidderPlacement = `${win.args.bidderCode}_${win.args.adUnitCode}`;

      let tempResult = tempStack.results[bidderPlacement];
      tempResult.status = 'won';
      tempStack.results[bidderPlacement] = tempResult;
    }
  }

  // we need to clear all sizes who hasn't timed out or responded to become empty
  // this should seriously be 0

  for (let key in tempStack.results) {
    var result = tempStack.results[key];
    if (result.status === 'requested') {
      const bidderPlacement = `${result.bidder}_${result.placement}`;
      result.status = 'missing';
      tempStack.results[bidderPlacement] = result;
    }
  }

  return JSON.stringify(tempStack);
}

function prepareSending() {
  setTimeout(function() {
    ajax(
      url,
      (result) => {
        // this is always called
        utils.logInfo('Sent payload to hpc analytic with result' + result);
      },
      getPayload()
    );
  }, 3000);
}

function pushEvent(eventType, args) {
  eventStack.events.push({ eventType, args });
}

function flushEvents() {
  eventStack.events = [];
}

let hpcAdapter = Object.assign(adapter({ url, analyticsType }),
  {
    track({ eventType, args }) {
      if (!checkOptions()) {
        return;
      }

      if (eventType === AUCTION_INIT) {
        flushEvents();
      }

      pushEvent(eventType, args);

      if (eventType === AUCTION_END) {
        prepareSending();
      }
    }
  });

hpcAdapter.originEnableAnalytics = hpcAdapter.enableAnalytics;

hpcAdapter.enableAnalytics = function (config) {
  initOptions = config.options;
  utils.logInfo('HPC Analytics enabled with config', initOptions);
  hpcAdapter.originEnableAnalytics(config);
};

adaptermanager.registerAnalyticsAdapter({
  adapter: hpcAdapter,
  code: 'hpc'
});

export default hpcAdapter;
