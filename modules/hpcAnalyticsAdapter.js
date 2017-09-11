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
let isAuctionStarted = false;

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
        const bidderPlacement = `${request.bidder}_${request.placementCode}`;

        let tempResult = tempStack.results[bidderPlacement];
        tempResult.bidder =  placement.bidder;
        tempResult.placement = placement.placementCode;
        tempResult.status = 'requested';
        tempStack.results[bidderPlacement] = tempResult;
      }
    }

    // this can happen i many variations
    if (event.eventType === BID_RESPONSE) {
      const response = event;
      const responseIsEmpty = (response.args.width === 0 || response.args.height === 0);
      const bidderPlacement = `${response.args.bidderCode}_${response.args.adUnitCode}`;

      let tempResult = tempStack.results[bidderPlacement] === undefined ? {} : tempStack.results[bidderPlacement];

      // if we already have responded make sure to not overwrite a better bid
      if ((tempResult === {}) || (response.args.cpm > tempResult.cpm)) {
        tempResult.status = responseIsEmpty ? 'empty' : 'responded';
        tempResult.cpm = response.args.cpm;
        tempResult.timeToRespond = response.args.timeToRespond;
        tempResult.size = `${response.args.width}x${response.args.height}`;
        tempStack.results[bidderPlacement] = tempResult;
      }

      tempStack.results[bidderPlacement] = tempResult;
    }

    if (event.eventType === AUCTION_END) {

    }

    // make sure how to get adServerPresure, listen to SET_TARGETING

    if (event.eventType === BID_TIMEOUT) {
      const timeout = event;
      let newTempStack = tempStack;

      for (let bidderCode of event.args) {
        newTempStack = newTempStack.results.map(result => {
          if (result.bidder === bidderCode) {
            result.status = 'timedout';
          }

          return result;
        });
      }

      tempStack = newTempStack;
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
    flushEvents();
    isAuctionStarted = false;
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
        isAuctionStarted = true;
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
