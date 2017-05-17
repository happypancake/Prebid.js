var bidfactory = require('src/bidfactory.js');
var bidmanager = require('src/bidmanager.js');
var adloader = require('src/adloader.js');
var utils = require('src/utils.js');

window.__switch_startTime = (new Date()).getTime();
window.__switch_placementCodeChains = {};
window.__switch_loadId = '';
window.__switch_fp = {

  /**
   * Get the browser viewport size
   */
  getViewportSize: function () {
    var viewport_width = -1, viewport_height = -1;

    try {
      var de = top.document.documentElement, db = top.document.body;

      if (typeof top.innerWidth === "number") {
        viewport_width = top.innerWidth;
        viewport_height = top.innerHeight;
      } else {

        if (de && (de.clientWidth || de.clientHeight)) {
          viewport_width = de.clientWidth;
          viewport_height = de.clientHeight;
        } else {
          if (db && (db.clientWidth || db.clientHeight)) {
            viewport_width = db.clientWidth;
            viewport_height = db.clientHeight;
          }
        }
      }
    } catch (err) {

    }

    return {w: viewport_width, h: viewport_height};
  },

  /**
   * Returns browser language (or system language on IE
   *
   * @returns {string} Language e.g. "en-GB"
   */
  getLanguage: function () {
    try {
      return window.navigator.userLanguage || window.navigator.language;
    } catch (ex) {
      return "";
    }
  },

  /**
   * Return platform e.g. "Linux x86_64"
   * @returns {string}
   */
  getPlatform: function () {
    try {
      return window.navigator.platform;
    } catch (ex) {
      return "";
    }
  },

  /**
   * Get screen resolution
   * @returns object
   */
  getResolution: function () {
    return this.getViewportSize();
  },

  getColourDepth: function () {
    try {
      return screen.colorDepth;
    } catch (ex) {
      return 0;
    }
  },

  getColourResolution: function () {
    try {
      return screen.pixelDepth;
    } catch (ex) {
      return 0;
    }
  },

  getTimezoneOffset: function () {
    return new Date().getTimezoneOffset();
  },

  getUserAgent: function () {
    return navigator.userAgent;
  },

  getPlugins: function () {
    var i, plugins = [];
    if (window.ActiveXObject) {
      var names = ["ShockwaveFlash.ShockwaveFlash",
        "AcroPDF.PDF",
        "PDF.PdfCtrl",
        "QuickTime.QuickTime",
        "rmocx.RealPlayer G2 Control",
        "rmocx.RealPlayer G2 Control.1",
        "RealPlayer.RealPlayer(tm) ActiveX Control (32-bit)",
        "RealVideo.RealVideo(tm) ActiveX Control (32-bit)",
        "RealPlayer",
        "SWCtl.SWCtl",
        "WMPlayer.OCX",
        "AgControl.AgControl",
        "Skype.Detection"];

      // starting to detect plugins in IE
      for (i = 0; i < names.length; i++) {
        try {
          new window.ActiveXObject(names[i]);
          plugins.push(names[i]);
        } catch (e) {
        }
      }
    } else {
      var mimes;
      for (i = 0; i < navigator.plugins.length; i++) {
        mimes = [];
        for (var j = 0; j < navigator.plugins[i].length; j++) {
          mimes.push(navigator.plugins[i][j].type + "~" + navigator.plugins[i][j].suffixes);
        }
        plugins.push(navigator.plugins[i].name + "/" + navigator.plugins[i].description + "/" + mimes.join(","));
      }

    }
    return plugins.join(";");
  },

  getProcessTime: function () {
    var start = (new Date()).getTime();
    var j = 0;
    for (var i = 0; i < 100000; i++) {
      j += i;
    }
    return (new Date()).getTime() - start;
  },

  getLoadTime: function () {
    return window.__switch_startTime;
  },

  getLoadOffsetTime: function () {
    return (new Date()).getTime() - window.__switch_startTime;
  },

  getCharacterSet: function () {
    return (window.document.charset ? window.document.charset : (window.document.characterSet ? window.document.characterSet : ""));
  },

  getSwitchEntropy: function () {
    var ent = "";
    try {
      var loc = "";
      var ref = "";

      try {
        ref = window.document.referrer || "";
      } catch (e) {
      }

      try {
        loc = window.location.href.toString() || "";
      } catch (e) {
      }

      ent += ";" + loc + ";" + ref;
    } catch (e) {

    }
    return ent;
  },

  /**
   * Murmur3 hash function (128 bit)
   *
   * @param {string} key
   * @param {number} seed
   * @returns {number[]}
   */
  murmur: function (key, seed) {
    var remainder = key.length % 16;
    var bytes = key.length - remainder;

    var h = [seed, seed, seed, seed];
    var c = [0x239b961b, 0xab0e9789, 0x38b34ae5, 0xa1e38b93];
    var k = [0, 0, 0, 0];

    function multiply_32(a, b) {
      return ((((a & 0xffff) * b) + ((((a >>> 16) * b) & 0xffff) << 16))) & 0xffffffff;
    }

    function add_32(a, b) {
      return ((a & 0xffff) + (b & 0xffff)) + ((((a >>> 16) + (b >>> 16)) & 0xffff) << 16);
    }

    function rotl32(x, r) {
      return (x << r) | (x >>> (32 - r));
    }

    function fmix32(h) {
      h ^= h >>> 16;
      h = multiply_32(h, 0x85ebca6b);
      h ^= h >>> 13;
      h = multiply_32(h, 0xc2b2ae35);
      h ^= h >>> 16;
      return h;
    }

    function next4bytes(key, offset) {
      var k =
          ((key.charCodeAt(offset) & 0xff)) |
          ((key.charCodeAt(++offset) & 0xff) << 8) |
          ((key.charCodeAt(++offset) & 0xff) << 16) |
          ((key.charCodeAt(++offset) & 0xff) << 24);
      offset++;
      return [k, offset];
    }

    function addhs(h) {
      h[0] = add_32(h[0], h[1]);
      h[0] = add_32(h[0], h[2]);
      h[0] = add_32(h[0], h[3]);
      h[1] = add_32(h[1], h[0]);
      h[2] = add_32(h[2], h[0]);
      h[3] = add_32(h[3], h[0]);
      return h;
    }

    //-----------
    // body
    //-----------
    function hashPortion(i, rotateK, rotateH, addition) {
      var next = (i + 1) & 3; // Plus 1 mod 4
      k[i] = multiply_32(k[i], c[i]);
      k[i] = rotl32(k[i], rotateK);
      k[i] = multiply_32(k[i], c[next]);

      h[i] ^= k[i];
      h[i] = rotl32(h[i], rotateH);
      h[i] = add_32(h[i], h[next]);
      h[i] = multiply_32(h[i], 5);
      h[i] = add_32(h[i], addition);
      return [k, h];
    }

    var offset = 0;
    var a, i;
    while (offset < bytes) {
      k = [0, 0, 0, 0];
      for (i = 0; i < 4; i++) {
        a = next4bytes(key, offset);
        k[i] = a[0];
        offset = a[1];
      }

      a = hashPortion(0, 15, 19, 0x561ccd1b);
      k = a[0];
      h = a[1];
      a = hashPortion(1, 16, 17, 0x0bcaa747);
      k = a[0];
      h = a[1];
      a = hashPortion(2, 17, 15, 0x96cd1c35);
      k = a[0];
      h = a[1];
      a = hashPortion(3, 18, 13, 0x32ac3b17);
      k = a[0];
      h = a[1];
    }

    k = [0, 0, 0, 0];

    switch (key.length & 15) {
      case 15:
        k[3] ^= (key.charCodeAt(offset + 14) & 0xff) << 16;
        /* falls through */
      case 14:
        k[3] ^= (key.charCodeAt(offset + 13) & 0xff) << 8;
        /* falls through */
      case 13:
        k[3] ^= (key.charCodeAt(offset + 12) & 0xff);
        k[3] = multiply_32(k[3], c[3]);
        k[3] = rotl32(k[3], 18);
        k[3] = multiply_32(k[3], c[0]);
        h[3] ^= k[3];
        /* falls through */
      case 12:
        k[2] ^= (key.charCodeAt(offset + 11) & 0xff) << 24;
        /* falls through */
      case 11:
        k[2] ^= (key.charCodeAt(offset + 10) & 0xff) << 16;
        /* falls through */
      case 10:
        k[2] ^= (key.charCodeAt(offset + 9) & 0xff) << 8;
        /* falls through */
      case  9:
        k[2] ^= (key.charCodeAt(offset + 8) & 0xff);
        k[2] = multiply_32(k[2], c[2]);
        k[2] = rotl32(k[2], 17);
        k[2] = multiply_32(k[2], c[3]);
        h[2] ^= k[2];
        /* falls through */
      case  8:
        k[1] ^= (key.charCodeAt(offset + 7) & 0xff) << 24;
        /* falls through */
      case  7:
        k[1] ^= (key.charCodeAt(offset + 6) & 0xff) << 16;
        /* falls through */
      case  6:
        k[1] ^= (key.charCodeAt(offset + 5) & 0xff) << 8;
        /* falls through */
      case  5:
        k[1] ^= (key.charCodeAt(offset + 4) & 0xff);
        k[1] = multiply_32(k[1], c[1]);
        k[1] = rotl32(k[1], 16);
        k[1] = multiply_32(k[1], c[2]);
        h[1] ^= k[1];
        /* falls through */
      case  4:
        k[0] ^= (key.charCodeAt(offset + 3) & 0xff) << 24;
        /* falls through */
      case  3:
        k[0] ^= (key.charCodeAt(offset + 2) & 0xff) << 16;
        /* falls through */
      case  2:
        k[0] ^= (key.charCodeAt(offset + 1) & 0xff) << 8;
        /* falls through */
      case  1:
        k[0] ^= (key.charCodeAt(offset) & 0xff);
        k[0] = multiply_32(k[0], c[0]);
        k[0] = rotl32(k[0], 15);
        k[0] = multiply_32(k[0], c[1]);
        h[0] ^= k[0];
    }

    for (i = 0; i < 4; i++) {
      h[i] ^= key.length;
    }

    h = addhs(h);

    for (i = 0; i < 4; i++) {
      h[i] = fmix32(h[i]);
    }

    h = addhs(h);

    for (i = 0; i < 4; i++) {
      h[i] = h[i] >>> 0;
    }
    return h;
  },

  /**
   * Event handler for mousemove event. Stores mouse x,y to use for ID entropy
   *
   * @param e
   */
  mousemove: function (e) {
    try {
      if (typeof this.mouse === 'undefined') this.mouse = {x: -1, y: -1};
      this.mouse.x = e.clientX || e.pageX;
      this.mouse.y = e.clientY || e.pageY;

    } catch (ex) {
    }

  },

  setupEventHandlers: function () {
    if (('HandlersReady' in this) && this.HandlersReady) return;

    try {
      if (window.addEventListener) {
        document.addEventListener('mousemove', this.mousemove);
      } else if (window.attachEvent) {
        document.attachEvent('onmousemove', this.mousemove);
      }
    } catch (e) {
    }
  },

  /**
   * Generates a unique ID
   *
   * @returns {string} unique_id
   */
  generate_id: function () {
    var start = (new Date()).getTime();
    var entropy = "";
    if ("seed" in this) {
      entropy = this.seed;
    }
    entropy += Math.random() + ";";

    var i;

    if ("crypto" in window && typeof Uint32Array !== "undefined") {
      try {
        var array = new Uint32Array(10);
        var rv = window.crypto.getRandomValues(array);
        for (i = 0; i < rv.length; i++) {
          entropy += rv[i];
        }
      } catch (e) {
      }
    }

    entropy += this.getCharacterSet();
    entropy += this.getColourDepth();
    entropy += this.getColourResolution();
    entropy += this.getLanguage();
    entropy += this.getLoadOffsetTime();
    entropy += this.getLoadTime();
    entropy += this.getPlatform();
    entropy += this.getPlugins();
    entropy += this.getProcessTime();
    entropy += JSON.stringify(this.getResolution());
    entropy += this.getSwitchEntropy();
    entropy += this.getTimezoneOffset();
    if ("performance" in window) entropy += JSON.stringify(window.performance);
    entropy += this.getUserAgent();
    entropy += "mouse" in this ? JSON.stringify(this.mouse) : "";
    entropy += (new Date()).getTime() - start;
    entropy += (new Date()).getTime();
    entropy += Math.random();

    var hash = this.murmur(entropy, Math.floor(Math.random() * 4294967295));

    var output = "";

    for (i = 0; i < hash.length; i++) {
      try {
        output += hash[i].toString(32);
      } catch (e) {
        output += "," + hash[i];
      }
    }

    try {
      if (document.removeEventListener) document.removeEventListener("mousemove", this.mousemove, false);
      if (document.detachEvent) document.detachEvent("onmousemove", this.mousemove);
    } catch (e) {
    }

    this.seed = output;
    return output;
  }
};
window.__switch_fp.setupEventHandlers();

var SwitchAdapter = function SwitchAdapter() {
  var gth = getTopUrl(), chainId;
  var usersync = false;

  function _callBids(params) {
    var BidRequests = [];

    window.__switch_loadId = window.__switch_fp.generate_id();

    for (var i = 0; i < params.bids.length; i++) {
      var adSizes = "", bid = params.bids[i];

      for (var x = 0; x < bid.sizes.length; x++) {
        adSizes += utils.parseGPTSingleSizeArray(bid.sizes[x]);
        if (x !== (bid.sizes.length - 1)) {
          adSizes += ',';
        }
      }

      chainId = window.__switch_fp.generate_id();

      BidRequests.push({
        "placementCode": bid.placementCode,
        "zone_id": bid.params.zoneId,
        "chain_id": chainId,
        "token": "T_" + window.__switch_fp.generate_id(),
        "sizes": adSizes,
        "variables": bid.params.variables,
        "source": bid.params.source
      });

      window.__switch_placementCodeChains[bid.placementCode] = chainId;
    }

    var bidsStr = JSON.stringify(BidRequests),
        reqURL = "//" + params.bids[0].params.domain + "/adserver/kromer.php?load_id=" + window.__switch_loadId +
            "&bids=" + encodeURIComponent(bidsStr) +
            "&callback=$$PREBID_GLOBAL$$.switchParseBids" +
            "&loc=" + encodeURIComponent(getLocation()) +
            "&ref=" + encodeURIComponent(getReferrer()) +
            "&gth=" + encodeURIComponent(gth);

    // @if NODE_ENV='debug'
    utils.logMessage('Switch request built: ' + reqURL);
    // @endif

    adloader.loadScript(reqURL);
  }

  function getTopUrl() {
    if (self === top) {
      return window.location.href;
    } else if ('ancestorOrigins' in window.location && window.location.ancestorOrigins.length > 0) {
      return window.location.ancestorOrigins[window.location.ancestorOrigins.length - 1];
    }
    return false;
  }

  /**
   * Gets the document referrer.
   * @returns {string}
   */
  function getReferrer() {
    var ref = '';
    try {
      ref = top.document.referrer || '';
    } catch (e) {
      ref = window.document.referrer || '';
    }
    return ref;
  }

  /**
   * Gets the current location.
   * @returns {string}
   */
  function getLocation() {
    var loc = '';
    try {
      loc = top.location.href.toString() || '';
    } catch (e) {
      loc = window.location.href.toString() || '';
    }
    return loc;
  }

  function createAdHtml(zoneId, adCode) {
    return `<html><head></head><body><div id="switch_placeholder_${zoneId}" class="switch_placeholder"></div>
    <script> (__scads = window.__scads || []).push({"z":${zoneId},"targetId":"switch_placeholder_${zoneId}","domain":"delivery.yieldoptimisers.net","width":"0","height":"0"}); </script>
    <script async src="//delivery.yieldoptimisers.net/adserver/sat.js"></script>${adCode}</body></html>`;
  }

  $$PREBID_GLOBAL$$.switchParseBids = function(bidResponses) {
    var bidObject;

    // @if NODE_ENV='debug'
    utils.logMessage('Callback for Switch running');
    // @endif

    utils._each(bidResponses, function (bidResponse) {
      if("cpm" in bidResponse && bidResponse.cpm > 0) {
        // @if NODE_ENV='debug'
        utils.logMessage('Switch bid available for ' + bidResponse.placementCode);
        // @endif

        bidObject = bidfactory.createBid(1);
        bidObject.bidderCode = 'switch';
        bidObject.cpm = bidResponse.cpm;
        bidObject.ad = createAdHtml(bidResponse.zoneId, bidResponse.ad);
        bidObject.width = bidResponse.width;
        bidObject.height = bidResponse.height;

        if (bidResponse.dealId) {
          bidObject.dealId = bidResponse.dealId;
        }

        bidmanager.addBidResponse(bidResponse.placementCode, bidObject);
      } else {
        // @if NODE_ENV='debug'
        utils.logMessage('No Switch bid available for ' + bidResponse.placementCode);
        // @endif

        bidObject = bidfactory.createBid(2);
        bidObject.bidderCode = 'switch';

        bidmanager.addBidResponse(bidResponse.placementCode, bidObject);
      }
    });

    if (!usersync) {
      var iframe = utils.createInvisibleIframe();
      iframe.src = '//delivery.swid.switchadhub.com/adserver/user_sync.php?node=http%3A%2F%2Fdelivery.yieldoptimisers.net%2Fadserver%2Fuser_sync.php&do[sync]=1&do[share]=1';
      try {
        document.body.appendChild(iframe);
      } catch (error) {
        utils.logError(error);
      }
      usersync = true;
    }
  };

  return {
    callBids: _callBids
  };
};

module.exports = SwitchAdapter;
