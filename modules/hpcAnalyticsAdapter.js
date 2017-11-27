import { ajax } from 'src/ajax';
import adapter from 'src/AnalyticsAdapter';
import adaptermanager from 'src/adaptermanager';
import * as utils from 'src/utils';

import CONSTANTS from 'src/constants.json';

const url = 'https://api.bitgn.com/hpc2?t=8e186e7f-1dd6-4b35-9846-05882a441bc0';
const analyticsType = 'endpoint';

const AUCTION_INIT = CONSTANTS.EVENTS.AUCTION_INIT;
const AUCTION_END = CONSTANTS.EVENTS.AUCTION_END;
const BID_REQUESTED = CONSTANTS.EVENTS.BID_REQUESTED;
const BID_TIMEOUT = CONSTANTS.EVENTS.BID_TIMEOUT;
const BID_RESPONSE = CONSTANTS.EVENTS.BID_RESPONSE;
const BID_WON = CONSTANTS.EVENTS.BID_WON;
const BID_ADJUSTMENT = CONSTANTS.EVENTS.BID_ADJUSTMENT;
const SET_TARGETING = CONSTANTS.EVENTS.SET_TARGETING;

let initOptions = { gender: null, age: null, id: null, shard: null, experiment: null };
let eventStack = [];
const endedAuctions = { placements: {} };

function checkOptions() {
  return initOptions.shard !== null;
}

function transformEvents(placement) {
  let tempStack = {
    auction: initOptions,
    results: {}
  };

  for (let eventKey in endedAuctions.placements[placement]) {
    const event = endedAuctions.placements[placement][eventKey];

    // this happens once per auction
    if (event.eventType === AUCTION_INIT) {
      const init = event;
      tempStack.auction.timeout = init.args.timeout;
    }

    // this happens once per bidderCode
    if (event.eventType === BID_REQUESTED) {
      const request = event;

      for (let placementKey in request.args.bids) {
        let placement = request.args.bids[placementKey];
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
      const responseIsEmpty = response.args.originalCpm === 0;

      let tempResult = tempStack.results[bidderPlacement];

      // we can only apply a empty to a requested, otherwise we will overwrite a response
      if (tempResult.status === 'requested' && responseIsEmpty) {
        tempResult.status = 'empty';
        tempResult.timeToRespond = response.args.timeToRespond;
      } else if (((tempResult.status === 'requested' || tempResult.status === 'empty') || response.args.originalCpm > tempResult.cpm) && !responseIsEmpty) {
        tempResult.status = 'responded';
        tempResult.cpm = response.args.originalCpm;
        tempResult.timeToRespond = response.args.timeToRespond;
        tempResult.size = `${response.args.width}x${response.args.height}`;
      }

      tempStack.results[bidderPlacement] = tempResult;
    }

    if (event.eventType === AUCTION_END) {

    }

    if (event.eventType === SET_TARGETING) {
    }

    if (event.eventType === BID_TIMEOUT) {
      const timeout = event;

      for (let bidderCodeKey in timeout.args) {
        let bidderCode = timeout.args[bidderCodeKey];
        for (let key in tempStack.results) {
          const result = tempStack.results[key];
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
    const result = tempStack.results[key];
    if (result.status === 'requested') {
      const bidderPlacement = `${result.bidder}_${result.placement}`;
      result.status = 'missing';
      tempStack.results[bidderPlacement] = result;
    }
  }

  return JSON.stringify(tempStack);
}

function prepareSending(placement) {
  setTimeout(function() {
    ajax(
      url,
      (result) => {
        // this is always called
        utils.logInfo('Sent payload to hpc analytic with result' + result);
      },
      transformEvents(placement)
    );
  }, 5000);
}

function pushEvent(eventType, args) {
  eventStack.push({ eventType, args });
}

function moveToEndedAuctions() {
  let placement = null;

  for (let eventKey in eventStack) {
    const event = eventStack[eventKey];

    if (event.eventType === BID_REQUESTED) {
      const request = event;

      for (let placementKey in request.args.bids) {
        const p = request.args.bids[placementKey];
        placement = p.placementCode;
        break;
      }
    }
  }

  endedAuctions.placements[placement] = eventStack;
  return placement;
}

function pushEventToEndedAuctions(placement, eventType, args) {
  endedAuctions.placements[placement].push({ eventType, args });
}

function flushEvents() {
  eventStack = [];
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
        const placement = moveToEndedAuctions();
      }

      if (eventType === SET_TARGETING) {
        const placement = args[0];
        prepareSending(placement);
      }

      if (eventType === BID_WON) {
        const placement = args.adUnitCode;
        pushEventToEndedAuctions(placement, eventType, args);
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
