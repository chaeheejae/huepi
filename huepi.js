// //////////////////////////////////////////////////////////////////////////////
//
// hue (Philips Wireless Lighting) Api interface for JavaScript
//  +-> HUEPI sounds like Joepie which makes me smile during development...
//
// Requires axios for http calls and uses regular modern Promisses
//
// //////////////////////////////////////////////////////////////////////////////

(function(exports){

  'use strict';

/**
 * HuepiLightstate Object.
 * Internal object to recieve all settings that are about to be send to the Bridge as a string.
 *
 * @class
 * @alias HuepiLightstate
 */
class HuepiLightstate {
  constructor(State) {
    if (State) {
      this.Merge(State)
    }
  }
  /**
  SetOn(On) {
    this.on = On;
    return this;
  } */
  /** */
  On() {
    this.on = true;
    return this;
  }
  /** */
  Off() {
    this.on = false;
    return this;
  }
  /*
   * @param {number} Hue Range [0..65535]
   * @param {float} Saturation Range [0..255]
   * @param {float} Brightness Range [0..255]
   */
  SetHSB(Hue, Saturation, Brightness) { // Range 65535, 255, 255
    this.hue = Math.round(Hue);
    this.sat = Math.round(Saturation);
    this.bri = Math.round(Brightness);
    return this;
  }
  /**
   * @param {number} Hue Range [0..65535]
   */
  SetHue(Hue) {
    this.hue = Math.round(Hue);
    return this;
  }
  /**
   * @param {float} Saturation Range [0..255]
   */
  SetSaturation(Saturation) {
    this.sat = Math.round(Saturation);
    return this;
  }
  /**
   * @param {float} Brightness Range [0..255]
   */
  SetBrightness(Brightness) {
    this.bri = Math.round(Brightness);
    return this;
  }
  /**
   * @param {float} Ang Range [0..360]
   * @param {float} Sat Range [0..1]
   * @param {float} Bri Range [0..1]
   */
  SetHueAngSatBri(Ang, Sat, Bri) {
    // In: Hue in Deg, Saturation, Brightness 0.0-1.0 Transform To Philips Hue Range...
    while (Ang < 0) {
      Ang = Ang + 360;
    }
    Ang = Ang % 360;
    return this.SetHSB(Math.round(Ang / 360 * 65535), Math.round(Sat * 255), Math.round(Bri * 255));
  }
  /**
   * @param {number} Red Range [0..1]
   * @param {number} Green Range [0..1]
   * @param {number} Blue Range [0..1]
   */
  SetRGB(Red, Green, Blue) {
    var HueAngSatBri;

    HueAngSatBri = Huepi.HelperRGBtoHueAngSatBri(Red, Green, Blue);
    return this.SetHueAngSatBri(HueAngSatBri.Ang, HueAngSatBri.Sat, HueAngSatBri.Bri);
  }
  /**
   * @param {number} Ct Micro Reciprocal Degree of Colortemperature (Ct = 10^6 / Colortemperature)
   */
  SetCT(Ct) {
    this.ct = Math.round(Ct);
    return this;
  }
  /**
   * @param {number} Colortemperature Range [2200..6500] for the 2012 lights
   */
  SetColortemperature(Colortemperature) {
    return this.SetCT(Huepi.HelperColortemperaturetoCT(Colortemperature));
  }
  /**
   * @param {float} X
   * @param {float} Y
   */
  SetXY(X, Y) {
    this.xy = [X, Y];
    return this;
  }
  /**
  SetAlert(Alert) {
    this.alert = Alert;
    return this;
  } */
  /** */
  AlertSelect() {
    this.alert = 'select';
    return this;
  }
  /** */
  AlertLSelect() {
    this.alert = 'lselect';
    return this;
  }
  /** */
  AlertNone() {
    this.alert = 'none';
    return this;
  }
  /**
  SetEffect(Effect) {
    this.effect = Effect;
    return this;
  }; */
  /** */
  EffectColorloop() {
    this.effect = 'colorloop';
    return this;
  }
  /** */
  EffectNone() {
    this.effect = 'none';
    return this;
  }
  /**
   * @param {number} Transitiontime Optional Transitiontime in multiple of 100ms
   *  defaults to 4 (on bridge, meaning 400 ms)
   */
  SetTransitiontime(Transitiontime) {
    if (typeof Transitiontime !== 'undefined') { // Optional Parameter
      this.transitiontime = Transitiontime;
    }
    return this;
  }
  /**
   * @returns {string} Stringified version of the content of LightState ready to be sent to the Bridge.
   */
  Get() {
    return JSON.stringify(this);
  }
  /**
   * @param {HuepiLightstate} NewState to Merge into this
   */
  Merge(NewState) {
    for (let key in NewState) {
      this[key] = NewState[key];
    }
    return this;
  }
}

/**
 * huepi Object, Entry point for all interaction with Lights etc via the Bridge.
 *
 * @class
 * @alias Huepi
 */
class Huepi {
  constructor() {
    /** @member {string} - version of the huepi interface */
    this.version = '1.5.0';

    /** @member {array} - Array of all Bridges on the local network */
    this.LocalBridges = [];

    /** @member {bool} - get: local network scan in progress / set:proceed with scan */
    this.ScanningNetwork = false;
    /** @member {number} - local network scan progress in % */
    this.ScanProgress = 0;

    /** @member {string} - IP address of the Current(active) Bridge */
    this.BridgeIP = '';
    /** @member {string} - ID (Unique, is MAC address) of the Current(active) Bridge */
    this.BridgeID = '';
    /** @member {string} - Username for Whitelisting, generated by the Bridge */
    this.Username = '';

    /** @member {object} - Cache Hashmap of huepi BridgeID and Whitelisted Username */
    this.BridgeCache = {};
    /** @member {boolean} - Autosave Cache Hasmap of huepi BridgeID and Whitelisted Username */
    this.BridgeCacheAutosave = true;
    this._BridgeCacheLoad(); // Load BridgeCache on creation by Default

    /** @member {object} - Configuration of the Current(active) Bridge */
    this.BridgeConfig = {};
    /** @member {string} - Name of the Current(active) Bridge */
    this.BridgeName = '';

    /** @member {array} - Array of all Lights of the Current(active) Bridge */
    this.Lights = [];
    /** @member {array} - Array of all LightIds of the Current(active) Bridge */
    this.LightIds = [];

    /** @member {array} - Array of all Groups of the Current(active) Bridge */
    this.Groups = [];
    /** @member {array} - Array of all GroupIds of the Current(active) Bridge */
    this.GroupIds = [];

    // To Do: Add Schedules, Scenes, Sensors & Rules manupulation functions, they are read only for now
    /** @member {array} - Array of all Schedules of the Current(active) Bridge,
     * NOTE: There are no Setter functions yet */
    this.Schedules = [];
    /** @member {array} - Array of all Scenes of the Current(active) Bridge,
     * NOTE: There are no Setter functions yet */
    this.Scenes = [];
    /** @member {array} - Array of all Sensors of the Current(active) Bridge,
     * NOTE: There are no Setter functions yet */
    this.Sensors = [];
    /** @member {array} - Array of all Rules of the Current(active) Bridge,
     * NOTE: There are no Setter functions yet */
    this.Rules = [];
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Private _BridgeCache Functions, Internally Used
  //
  //

  /**
   * Loads the BridgeCache, typically on startup
   */
  _BridgeCacheLoad() {
    this.BridgeCache = {};
    try {
      if (typeof window !== 'undefined') {
        let huepiBridgeCache = localStorage.huepiBridgeCache || '{}';

        this.BridgeCache = JSON.parse(huepiBridgeCache); // Load
      } else if (typeof module !== 'undefined' && module.exports) {
        let fs = require('fs');
        let buffer = fs.readFileSync('huepiBridgeCache.json');

        this.BridgeCache = JSON.parse(buffer.toString());
      }
      // console.log('_BridgeCacheLoad()-ed : \n '+ JSON.stringify(this.BridgeCache));
    } catch (error) {
      // console.log('Unable to _BridgeCacheLoad() ' + error);
    }
  }

  _BridgeCacheAddCurrent() {
    // console.log('_BridgeCacheAddCurrent ' + this.BridgeID + ' ' + this.Username);
    this.BridgeCache[this.BridgeID] = this.Username;
    if (this.BridgeCacheAutosave) {
      this._BridgeCacheSave();
    }
  }

  _BridgeCacheRemoveCurrent() {
    if (this.BridgeCache[this.BridgeID] === this.Username) {
      // console.log('_BridgeCacheRemoveCurrent ' + this.BridgeID + ' ' + this.Username);
      delete this.BridgeCache[this.BridgeID];
      if (this.BridgeCacheAutosave) {
        this._BridgeCacheSave();
      }
    }
  }

  /**
   * Selects the first Bridge from LocalBridges found in BridgeCache and stores in BridgeIP
   *  defaults to 1st Bridge in LocalBridges if no bridge from LocalBridges is found in BridgeCache
   *
   * Internally called in PortalDiscoverLocalBridges and NetworkDiscoverLocalBridges
   */
  _BridgeCacheSelectFromLocalBridges() {
    if (this.LocalBridges.length > 0) { // Local Bridges are found
      this.BridgeIP = this.LocalBridges[0].internalipaddress || ''; // Default to 1st Bridge Found
      this.BridgeID = this.LocalBridges[0].id.toLowerCase() || '';
      if (!this.BridgeCache[this.BridgeID]) { // if this.BridgeID not found in BridgeCache
        for (let BridgeNr = 1; BridgeNr < this.LocalBridges.length; BridgeNr++) { // Search and store Found
          this.BridgeID = this.LocalBridges[BridgeNr].id.toLowerCase();
          if (this.BridgeCache[this.BridgeID]) {
            this.BridgeIP = this.LocalBridges[BridgeNr].internalipaddress;
            break;
          } else {
            this.BridgeID = '';
          }
        }
      }
    }
    this.Username = this.BridgeCache[this.BridgeID] || '';
  }

  /**
   * Saves the BridgeCache, typically on Whitelist new Device or Device no longer whitelisted
   *   as is the case with with @BridgeCacheAutosave on @_BridgeCacheAddCurrent and @_BridgeCacheRemoveCurrent
   * NOTE: Saving this cache might be considered a security issue
   * To counter this security issue, arrange your own load/save code with proper encryption
   */
  _BridgeCacheSave() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.huepiBridgeCache = JSON.stringify(this.BridgeCache); // Save
      } else if (typeof module !== 'undefined' && module.exports) {
        let fs = require('fs');

        fs.writeFileSync('huepiBridgeCache.json', JSON.stringify(this.BridgeCache));
      }
      // console.log('_BridgeCacheSave()-ed  : \n '+ JSON.stringify(this.BridgeCache));
    } catch (error) {
      // console.log('Unable to _BridgeCacheSave() ' + error);
    }
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Network Functions
  //
  //

  /**
   *
   */
  _NetworkDiscoverLocalIPs() { // resolves LocalIPs[]
    let LocalIPs = [];
    let RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    let PeerConnection = new RTCPeerConnection({ iceServers: [] });

    PeerConnection.createDataChannel('');

    return new Promise((resolve) => {
      PeerConnection.onicecandidate = (e) => {
        if (!e.candidate) {
          PeerConnection.close();
          return resolve(LocalIPs);
        }
        let LocalIP = /^candidate:.+ (\S+) \d+ typ/.exec(e.candidate.candidate)[1];

        if (LocalIPs.indexOf(LocalIP) === -1) {
          LocalIPs.push(LocalIP);
        }
        return LocalIPs;
      };
      PeerConnection.createOffer((sdp) => {
        PeerConnection.setLocalDescription(sdp);
      }, () => { });
    });
  }

  /**
   *
   */
  _NetworkCheckLocalIP(InitialIP, Offset, Parallel, OnResolve) { 
    this.BridgeGetConfig(InitialIP + Offset, 1000).then((data) => {
      let Bridge = data;

      Bridge.internalipaddress = InitialIP + Offset;
      Bridge.id = data.bridgeid.toLowerCase();
      this.LocalBridges.push(Bridge);
    }).catch((error) => {
    }).then(() => { // then().catch().then() is similar to .done(), .always() or .finally()
      this.ScanProgress = Math.round(100*Offset/255);
      if (this.ScanningNetwork === false) {
        Offset = 256; // Stop scanning if (this.ScanningNetwork = false)
      } else {
        Offset += Parallel;
      }
      if (Offset < 256) {
        this._NetworkCheckLocalIP(InitialIP, Offset, Parallel, OnResolve);
      } else {
        this.ScanningNetwork = false;
        OnResolve();
      }
    });
  }

  /**
   *
   */
  _NetworkDiscoverLocalBridges(LocalIPs) {
    let Parallel = 16;
    let Promisses = [];

    this.ScanProgress = 0;
    for (let IPs = 0; IPs < LocalIPs.length; IPs++) {
      let InitialIP = LocalIPs[IPs].slice(0, LocalIPs[IPs].lastIndexOf('.') + 1);

      for (let Offset = 1; Offset <= Parallel; Offset++) {
        Promisses.push( new Promise((resolve, reject) => {
          this._NetworkCheckLocalIP(InitialIP, Offset, Parallel, resolve);
        }) );
      }
    }
    return Promise.all(Promisses);
  }

  /**
   * Creates the list of hue-Bridges on the local network
   */
  NetworkDiscoverLocalBridges() {
    this.ScanningNetwork = true;
    this.BridgeIP =
      this.BridgeID =
      this.BridgeName =
      this.Username = '';
    this.LocalBridges = [];

    return new Promise((resolve, reject) => {
      this._NetworkDiscoverLocalIPs().then((LocalIPs) => {
        this._NetworkDiscoverLocalBridges(LocalIPs).then(() => {
          if (this.LocalBridges.length > 0) {
            this._BridgeCacheSelectFromLocalBridges();
            resolve();
          } else {
            reject();
          }
        });
      });
    });
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Portal Functions
  //
  //

  /**
   * Retreives the list of hue-Bridges on the local network from the hue Portal
   */
  PortalDiscoverLocalBridges() {
    this.BridgeIP =
      this.BridgeID =
      this.BridgeName =
      this.Username = '';
    this.LocalBridges = [];
    return new Promise((resolve, reject) => {
      Huepi.http.get('https://www.meethue.com/api/nupnp').then((response) => {
        return response.data;
      }).then((data) => {
        if (data.length > 0) {
          if (data[0].internalipaddress) { // Bridge(s) Discovered
            this.LocalBridges = data;
            this._BridgeCacheSelectFromLocalBridges();
            resolve(data);
          } else {
            reject('No Bridges found via Portal');
          }
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  //  Bridge Functions
  //
  //

  /**
   * Function to retreive BridgeConfig before Checking Whitelisting.
   * ONCE call BridgeGetConfig Before BridgeGetData to validate we are talking to a hue Bridge
   * available members (as of 'apiversion': '1.11.0'):
   *   name, apiversion, swversion, mac, bridgeid, replacesbridgeid, factorynew, modelid
   *
   * @param {string} ConfigBridgeIP - Optional BridgeIP to GetConfig from, otherwise uses BridgeIP (this).
   * @param {string} ConfigTimeOut - Optional TimeOut for network request, otherwise uses 60 seconds.
   */
  BridgeGetConfig(ConfigBridgeIP, ConfigTimeOut) { // GET /api/config -> data.config.whitelist.username
    ConfigBridgeIP = ConfigBridgeIP || this.BridgeIP;
    ConfigTimeOut = ConfigTimeOut || 60000;

    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + ConfigBridgeIP + '/api/config/', { timeout: ConfigTimeOut }).then((response) => {
        return response.data;
      }).then((data) => {
        if (data.bridgeid) {
          if (this.BridgeIP === ConfigBridgeIP) {
            this.BridgeConfig = data;
            if (this.BridgeConfig.bridgeid) { // SteveyO/Hue-Emulator doesn't supply bridgeid as of yet.
              this.BridgeID = this.BridgeConfig.bridgeid.toLowerCase();
            } else {
              this.BridgeID = '';
            }
            this.BridgeName = this.BridgeConfig.name;
            this.Username = this.BridgeCache[this.BridgeID];
            if (typeof this.Username === 'undefined') {
              this.Username = '';
            }
          }
          resolve(data);
        } else { // this BridgeIP is not a hue Bridge
          reject('this BridgeIP is not a hue Bridge');
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  /**
   * Function to retreive BridgeDescription before Checking Whitelisting.
   * ONCE call BridgeGetDescription Before BridgeGetData to validate we are talking to a hue Bridge
   *
   * REMARK: Needs a fix of the hue bridge to allow CORS on xml endpoint too,
   *  just like on json endpoints already is implemented.
   *
   * @param {string} ConfigBridgeIP - Optional BridgeIP to GetConfig from, otherwise uses BridgeIP (this).
   * @param {string} ConfigTimeOut - Optional TimeOut for network request, otherwise uses 60 seconds.
   */
  BridgeGetDescription(ConfigBridgeIP, ConfigTimeOut) { // GET /description.xml -> /device/serialNumber
    ConfigBridgeIP = ConfigBridgeIP || this.BridgeIP;
    ConfigTimeOut = ConfigTimeOut || 60000;

    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + ConfigBridgeIP + '/description.xml', { timeout: ConfigTimeOut }).then((response) => {
        return response.data;
      }).then((data) => {
        if (data.indexOf('hue_logo_0.png') > 0) {
          if (data.indexOf('<serialNumber>') > 0) {
            this.BridgeID = data.substr(14 + data.indexOf('<serialNumber>'),
             data.indexOf('</serialNumber>') - data.indexOf('<serialNumber>') - 14).toLowerCase();
          }
          if (data.indexOf('<friendlyName>') > 0) {
            this.BridgeName = data.substr(14 + data.indexOf('<friendlyName>'),
             data.indexOf('</friendlyName>') - data.indexOf('<friendlyName>') - 14);
          }
          this.Username = this.BridgeCache[this.BridgeID];
          if (typeof this.Username === 'undefined') {
            // Correct 001788[....]200xxx -> 001788FFFE200XXX short and long serialnumer difference
            this.BridgeID = this.BridgeID.slice(0, 6) + 'fffe' + this.BridgeID.slice(6, 12);
            this.Username = this.BridgeCache[this.BridgeID];
            if (typeof this.Username === 'undefined') {
              this.Username = '';
            }
          }
          resolve(data);
        } else { // this BridgeIP is not a hue Bridge
          reject('this BridgeIP is not a hue Bridge');
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  /**
   * Update function to retreive Bridge data and store it in this object.
   * Consider this the main 'Get' function.
   * Typically used for Heartbeat or manual updates of local data.
   */
  BridgeGetData() { // GET /api/username -> data.config.whitelist.username
    return new Promise((resolve, reject) => {
      if (this.Username === '') {
        reject('Username must be set before calling BridgeGetData');
      } else {
        Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username).then((response) => {
          return response.data;
        }).then((data) => {
          if (typeof data.config !== 'undefined') { // if able to read Config, Username must be Whitelisted
            this.BridgeConfig = data.config;
            if (this.BridgeConfig.bridgeid) { // SteveyO/Hue-Emulator doesn't supply bridgeid as of yet.
              this.BridgeID = this.BridgeConfig.bridgeid.toLowerCase();
            } else {
              this.BridgeID = '';
            }
            this.BridgeName = this.BridgeConfig.name;
            this.Lights = data.lights;
            this.LightIds = [];
            for (let key in this.Lights) {
              this.LightIds.push(key);
            }
            this.Groups = data.groups;
            this.GroupIds = [];
            for (let key in this.Groups) {
              this.GroupIds.push(key);
            }
            this.Schedules = data.schedules;
            this.Scenes = data.scenes;
            this.Sensors = data.sensors;
            this.Rules = data.rules;
            this.BridgeName = this.BridgeConfig.name;
            resolve(data);
          } else { // Username is no longer whitelisted
            if (this.Username !== '') {
              this._BridgeCacheRemoveCurrent();
            }
            this.Username = '';
            reject('Username is no longer whitelisted');
          }
        }).catch(function (message) { // fetch failed
          reject(message);
        });
      }
    });
  }

  /**
   * Whitelists the Username stored in this object.
   * Note: a buttonpress on the bridge is requered max 30 sec before this to succeed.
   * please only use this once per device, Username is stored in cache.
   *
   * @param {string} DeviceName - Optional device name to Whitelist.
   */
  BridgeCreateUser(DeviceName) {
  // POST /api {'devicetype': 'AppName#DeviceName' }
    DeviceName = DeviceName || 'WebInterface';

    return new Promise((resolve, reject) => {
      Huepi.http.post('http://' + this.BridgeIP + '/api',
      {"devicetype": "huepi#' + DeviceName + '"}).then((response) => {
        return response.data;
      }).then((data) => {
        if ((data[0]) && (data[0].success)) {
          this.Username = data[0].success.username;
          this._BridgeCacheAddCurrent();
          resolve(data);
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  /**
   * @param {string} UsernameToDelete - Username that will be revoked from the Whitelist.
   * Note: Username stored in this object need to be Whitelisted to succeed.
   */
  BridgeDeleteUser(UsernameToDelete) {
  // DELETE /api/username/config/whitelist/username {'devicetype': 'iPhone', 'username': '1234567890'}
    return Huepi.http.delete('http://' + this.BridgeIP + '/api/' + this.Username + '/config/whitelist/' + UsernameToDelete);
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  //  Huepi.Helper Functions
  //
  //

  /**
   * @param {string} Model
   * @returns {boolean} Model is capable of CT
   */
  static HelperModelCapableCT(Model) { // CT Capable	LCT* LLM* LTW* LLC020 LST002
    let ModelType = Model.slice(0, 3);

    return ((ModelType === 'LCT') || (ModelType === 'LLM') || (ModelType === 'LTW') ||
    (Model === 'LLC020') || (Model === 'LST002'));
  }

  /**
  * @param {string} Model
  * @returns {boolean} Model is capable of XY
  */
  static HelperModelCapableXY(Model) { // XY Capable	LCT* LLC* LST* LLM001 LLC020 LST002
    let ModelType = Model.slice(0, 3);

    return ((ModelType === 'LCT') || (ModelType === 'LLC') || (ModelType === 'LST') ||
    (Model === 'LLM001') || (Model === 'LLC020') || (Model === 'LST002'));
  }

  /**
   * @param {float} Red - Range [0..1]
   * @param {float} Green - Range [0..1]
   * @param {float} Blue - Range [0..1]
   * @returns {object} [Ang, Sat, Bri] - Ranges [0..360] [0..1] [0..1]
   */
  static HelperRGBtoHueAngSatBri(Red, Green, Blue) {
    let Ang, Sat, Bri;
    let Min = Math.min(Red, Green, Blue);
    let Max = Math.max(Red, Green, Blue);

    if (Min !== Max) {
      if (Red === Max) {
        Ang = (0 + ((Green - Blue) / (Max - Min))) * 60;
      } else if (Green === Max) {
        Ang = (2 + ((Blue - Red) / (Max - Min))) * 60;
      } else {
        Ang = (4 + ((Red - Green) / (Max - Min))) * 60;
      }
      Sat = (Max - Min) / Max;
      Bri = Max;
    } else { // Max === Min
      Ang = 0;
      Sat = 0;
      Bri = Max;
    }
    return { Ang: Ang, Sat: Sat, Bri: Bri };
  }

  /**
   * @param {float} Ang - Range [0..360]
   * @param {float} Sat - Range [0..1]
   * @param {float} Bri - Range [0..1]
   * @returns {object} [Red, Green, Blue] - Ranges [0..1] [0..1] [0..1]
   */
  static HelperHueAngSatBritoRGB(Ang, Sat, Bri) { // Range 360, 1, 1, return .Red, .Green, .Blue
    let Red, Green, Blue;

    if (Sat === 0) {
      Red = Bri;
      Green = Bri;
      Blue = Bri;
    } else {
      let Sector = Math.floor(Ang / 60) % 6;
      let Fraction = (Ang / 60) - Sector;
      let p = Bri * (1 - Sat);
      let q = Bri * (1 - Sat * Fraction);
      let t = Bri * (1 - Sat * (1 - Fraction));

      switch (Sector) {
        case 0:
          Red = Bri;
          Green = t;
          Blue = p;
          break;
        case 1:
          Red = q;
          Green = Bri;
          Blue = p;
          break;
        case 2:
          Red = p;
          Green = Bri;
          Blue = t;
          break;
        case 3:
          Red = p;
          Green = q;
          Blue = Bri;
          break;
        case 4:
          Red = t;
          Green = p;
          Blue = Bri;
          break;
        default: // case 5:
          Red = Bri;
          Green = p;
          Blue = q;
          break;
      }
    }
    return { Red: Red, Green: Green, Blue: Blue };
  }

  /**
   * @param {float} Red - Range [0..1]
   * @param {float} Green - Range [0..1]
   * @param {float} Blue - Range [0..1]
   * @returns {number} Temperature ranges [2200..6500]
   */
  static HelperRGBtoColortemperature(Red, Green, Blue) {
  // Approximation from https://github.com/neilbartlett/color-temperature/blob/master/index.js
    let Temperature;
    let TestRGB;
    let Epsilon = 0.4;
    let MinTemperature = 2200;
    let MaxTemperature = 6500;

    while ((MaxTemperature - MinTemperature) > Epsilon) {
      Temperature = (MaxTemperature + MinTemperature) / 2;
      TestRGB = Huepi.HelperColortemperaturetoRGB(Temperature);
      if ((TestRGB.Blue / TestRGB.Red) >= (Blue / Red)) {
        MaxTemperature = Temperature;
      } else {
        MinTemperature = Temperature;
      }
    }
    return Math.round(Temperature);
  }

  /**
   * @param {number} Temperature ranges [1000..6600]
   * @returns {object} [Red, Green, Blue] ranges [0..1] [0..1] [0..1]
   */
  static HelperColortemperaturetoRGB(Temperature) {
  // http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
  // Update Available: https://github.com/neilbartlett/color-temperature/blob/master/index.js
    let Red, Green, Blue;

    Temperature = Temperature / 100;
    if (Temperature <= 66) {
      Red = /* 255; */ 165 + 90 * ((Temperature) / (66));
    } else {
      Red = Temperature - 60;
      Red = 329.698727466 * Math.pow(Red, -0.1332047592);
      if (Red < 0) {
        Red = 0;
      }
      if (Red > 255) {
        Red = 255;
      }
    }
    if (Temperature <= 66) {
      Green = Temperature;
      Green = 99.4708025861 * Math.log(Green) - 161.1195681661;
      if (Green < 0) {
        Green = 0;
      }
      if (Green > 255) {
        Green = 255;
      }
    } else {
      Green = Temperature - 60;
      Green = 288.1221695283 * Math.pow(Green, -0.0755148492);
      if (Green < 0) {
        Green = 0;
      }
      if (Green > 255) {
        Green = 255;
      }
    }
    if (Temperature >= 66) {
      Blue = 255;
    } else {
      if (Temperature <= 19) {
        Blue = 0;
      } else {
        Blue = Temperature - 10;
        Blue = 138.5177312231 * Math.log(Blue) - 305.0447927307;
        if (Blue < 0) {
          Blue = 0;
        }
        if (Blue > 255) {
          Blue = 255;
        }
      }
    }
    return { Red: Red / 255, Green: Green / 255, Blue: Blue / 255 };
  }

  /**
   * @param {float} Red - Range [0..1]
   * @param {float} Green - Range [0..1]
   * @param {float} Blue - Range [0..1]
   * @returns {object} [x, y] - Ranges [0..1] [0..1]
   */
  static HelperRGBtoXY(Red, Green, Blue) {
  // Source: https://github.com/PhilipsHue/PhilipsHueSDK-iOS-OSX/blob/master/
  // ApplicationDesignNotes/RGB%20to%20xy%20Color%20conversion.md
    // Apply gamma correction
    if (Red > 0.04045) {
      Red = Math.pow((Red + 0.055) / (1.055), 2.4);
    } else {
      Red = Red / 12.92;
    }
    if (Green > 0.04045) {
      Green = Math.pow((Green + 0.055) / (1.055), 2.4);
    } else {
      Green = Green / 12.92;
    }
    if (Blue > 0.04045) {
      Blue = Math.pow((Blue + 0.055) / (1.055), 2.4);
    } else {
      Blue = Blue / 12.92;
    }
    // RGB to XYZ [M] for Wide RGB D65, http://www.developers.meethue.com/documentation/color-conversions-rgb-xy
    let X = Red * 0.664511 + Green * 0.154324 + Blue * 0.162028;
    let Y = Red * 0.283881 + Green * 0.668433 + Blue * 0.047685;
    let Z = Red * 0.000088 + Green * 0.072310 + Blue * 0.986039;

    // But we don't want Capital X,Y,Z you want lowercase [x,y] (called the color point) as per:
    if ((X + Y + Z) === 0) {
      return { x: 0, y: 0 };
    }
    return { x: X / (X + Y + Z), y: Y / (X + Y + Z) };
  }

  /**
   * @param {float} x
   * @param {float} y
   * @param {float} Brightness Optional
   * @returns {object} [Red, Green, Blue] - Ranges [0..1] [0..1] [0..1]
   */
  static HelperXYtoRGB(x, y, Brightness) {
  // Source: https://github.com/PhilipsHue/PhilipsHueSDK-iOS-OSX/blob/master/
  // ApplicationDesignNotes/RGB%20to%20xy%20Color%20conversion.md
    Brightness = Brightness || 1.0; // Default full brightness
    let z = 1.0 - x - y;
    let Y = Brightness;
    let X = (Y / y) * x;
    let Z = (Y / y) * z;
    // XYZ to RGB [M]-1 for Wide RGB D65, http://www.developers.meethue.com/documentation/color-conversions-rgb-xy
    let Red = X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    let Green = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    let Blue = X * 0.051713 - Y * 0.121364 + Z * 1.011530;

    // Limit RGB on [0..1]
    if (Red > Blue && Red > Green && Red > 1.0) { // Red is too big
      Green = Green / Red;
      Blue = Blue / Red;
      Red = 1.0;
    }
    if (Red < 0) {
      Red = 0;
    }
    if (Green > Blue && Green > Red && Green > 1.0) { // Green is too big
      Red = Red / Green;
      Blue = Blue / Green;
      Green = 1.0;
    }
    if (Green < 0) {
      Green = 0;
    }
    if (Blue > Red && Blue > Green && Blue > 1.0) { // Blue is too big
      Red = Red / Blue;
      Green = Green / Blue;
      Blue = 1.0;
    }
    if (Blue < 0) {
      Blue = 0;
    }
    // Apply reverse gamma correction
    if (Red <= 0.0031308) {
      Red = Red * 12.92;
    } else {
      Red = 1.055 * Math.pow(Red, (1.0 / 2.4)) - 0.055;
    }
    if (Green <= 0.0031308) {
      Green = Green * 12.92;
    } else {
      Green = 1.055 * Math.pow(Green, (1.0 / 2.4)) - 0.055;
    }
    if (Blue <= 0.0031308) {
      Blue = Blue * 12.92;
    } else {
      Blue = 1.055 * Math.pow(Blue, (1.0 / 2.4)) - 0.055;
    }
    // Limit RGB on [0..1]
    if (Red > Blue && Red > Green && Red > 1.0) { // Red is too big
      Green = Green / Red;
      Blue = Blue / Red;
      Red = 1.0;
    }
    if (Red < 0) {
      Red = 0;
    }
    if (Green > Blue && Green > Red && Green > 1.0) { // Green is too big
      Red = Red / Green;
      Blue = Blue / Green;
      Green = 1.0;
    }
    if (Green < 0) {
      Green = 0;
    }
    if (Blue > Red && Blue > Green && Blue > 1.0) { // Blue is too big
      Red = Red / Blue;
      Green = Green / Blue;
      Blue = 1.0;
    }
    if (Blue < 0) {
      Blue = 0;
    }
    return { Red: Red, Green: Green, Blue: Blue };
  }

  /**
   * @param {float} x
   * @param {float} y
   * @param {float} Brightness Optional
   * @param {string} Model - Modelname of the Light
   * @returns {object} [Red, Green, Blue] - Ranges [0..1] [0..1] [0..1]
   */
  static HelperXYtoRGBforModel(x, y, Brightness, Model) {
    let GamutCorrected = Huepi.HelperGamutXYforModel(x, y, Model);

    return Huepi.HelperXYtoRGB(GamutCorrected.x, GamutCorrected.y, Brightness);
  }

  /**
   * Tests if the Px,Py resides within the Gamut for the model.
   * Otherwise it will calculated the closesed point on the Gamut.
   * @param {float} Px - Range [0..1]
   * @param {float} Py - Range [0..1]
   * @param {string} Model - Modelname of the Light to Gamutcorrect Px, Py for
   * @returns {object} [x, y] - Ranges [0..1] [0..1]
   */
  static HelperGamutXYforModel(Px, Py, Model) { // https://developers.meethue.com/documentation/supported-lights
    Model = Model || 'LCT001'; // default hue Bulb 2012
    let ModelType = Model.slice(0, 3);
    let PRed, PGreen, PBlue;
    let NormDot;

    if (((ModelType === 'LST') || (ModelType === 'LLC')) &&
      (Model !== 'LLC020') && (Model !== 'LLC002') && (Model !== 'LST002')) {
    // For LivingColors Bloom, Aura and Iris etc the triangle corners are:
      PRed = { x: 0.704, y: 0.296 }; // Gamut A
      PGreen = { x: 0.2151, y: 0.7106 };
      PBlue = { x: 0.138, y: 0.080 };
    } else if (((ModelType === 'LCT') || (ModelType === 'LLM')) &&
      (Model !== 'LCT010') && (Model !== 'LCT014') && (Model !== 'LCT011') && (Model !== 'LCT012')) {
    // For the hue bulb and beyond led modules etc the corners of the triangle are:
      PRed = { x: 0.675, y: 0.322 }; // Gamut B
      PGreen = { x: 0.409, y: 0.518 };
      PBlue = { x: 0.167, y: 0.040 };
    } else { // Exceptions and Unknown default to
      PRed = { x: 0.692, y: 0.308 }; // Gamut C
      PGreen = { x: 0.17, y: 0.7 };
      PBlue = { x: 0.153, y: 0.048 };
    }

    let VBR = { x: PRed.x - PBlue.x, y: PRed.y - PBlue.y }; // Blue to Red
    let VRG = { x: PGreen.x - PRed.x, y: PGreen.y - PRed.y }; // Red to Green
    let VGB = { x: PBlue.x - PGreen.x, y: PBlue.y - PGreen.y }; // Green to Blue

    let GBR = (PGreen.x - PBlue.x) * VBR.y - (PGreen.y - PBlue.y) * VBR.x; // Sign Green on Blue to Red
    let BRG = (PBlue.x - PRed.x) * VRG.y - (PBlue.y - PRed.y) * VRG.x; // Sign Blue on Red to Green
    let RGB = (PRed.x - PGreen.x) * VGB.y - (PRed.y - PGreen.y) * VGB.x; // Sign Red on Green to Blue

    let VBP = { x: Px - PBlue.x, y: Py - PBlue.y }; // Blue to Point
    let VRP = { x: Px - PRed.x, y: Py - PRed.y }; // Red to Point
    let VGP = { x: Px - PGreen.x, y: Py - PGreen.y }; // Green to Point

    let PBR = VBP.x * VBR.y - VBP.y * VBR.x; // Sign Point on Blue to Red
    let PRG = VRP.x * VRG.y - VRP.y * VRG.x; // Sign Point on Red to Green
    let PGB = VGP.x * VGB.y - VGP.y * VGB.x; // Sign Point on Green to Blue

    if ((GBR * PBR >= 0) && (BRG * PRG >= 0) && (RGB * PGB >= 0)) { // All Signs Match so Px,Py must be in triangle
      return { x: Px, y: Py };
    //  Outside Triangle, Find Closesed point on Edge or Pick Vertice...
    } else if (GBR * PBR <= 0) { // Outside Blue to Red
      NormDot = (VBP.x * VBR.x + VBP.y * VBR.y) / (VBR.x * VBR.x + VBR.y * VBR.y);
      if ((NormDot >= 0.0) && (NormDot <= 1.0)) { // Within Edge
        return { x: PBlue.x + NormDot * VBR.x, y: PBlue.y + NormDot * VBR.y };
      } else if (NormDot < 0.0) { // Outside Edge, Pick Vertice
        return { x: PBlue.x, y: PBlue.y }; // Start
      }
      return { x: PRed.x, y: PRed.y }; // End
    } else if (BRG * PRG <= 0) { // Outside Red to Green
      NormDot = (VRP.x * VRG.x + VRP.y * VRG.y) / (VRG.x * VRG.x + VRG.y * VRG.y);
      if ((NormDot >= 0.0) && (NormDot <= 1.0)) { // Within Edge
        return { x: PRed.x + NormDot * VRG.x, y: PRed.y + NormDot * VRG.y };
      } else if (NormDot < 0.0) { // Outside Edge, Pick Vertice
        return { x: PRed.x, y: PRed.y }; // Start
      }
      return { x: PGreen.x, y: PGreen.y }; // End
    } else if (RGB * PGB <= 0) { // Outside Green to Blue
      NormDot = (VGP.x * VGB.x + VGP.y * VGB.y) / (VGB.x * VGB.x + VGB.y * VGB.y);
      if ((NormDot >= 0.0) && (NormDot <= 1.0)) { // Within Edge
        return { x: PGreen.x + NormDot * VGB.x, y: PGreen.y + NormDot * VGB.y };
      } else if (NormDot < 0.0) { // Outside Edge, Pick Vertice
        return { x: PGreen.x, y: PGreen.y }; // Start
      }
      return { x: PBlue.x, y: PBlue.y }; // End
    }
    return { x: 0.5, y: 0.5 }; // Silence return warning
  }

  /**
   * @param {float} Ang - Range [0..360]
   * @param {float} Sat - Range [0..1]
   * @param {float} Bri - Range [0..1]
   * @returns {number} Temperature ranges [2200..6500]
   */
  static HelperHueAngSatBritoColortemperature(Ang, Sat, Bri) {
    let RGB;

    RGB = Huepi.HelperHueAngSatBritoRGB(Ang, Sat, Bri);
    return Huepi.HelperRGBtoColortemperature(RGB.Red, RGB.Green, RGB.Blue);
  }

  /**
   * @param {number} Temperature ranges [1000..6600]
   * @returns {object} [Ang, Sat, Bri] - Ranges [0..360] [0..1] [0..1]
   */
  static HelperColortemperaturetoHueAngSatBri(Temperature) {
    let RGB;

    RGB = Huepi.HelperColortemperaturetoRGB(Temperature);
    return Huepi.HelperRGBtoHueAngSatBri(RGB.Red, RGB.Green, RGB.Blue);
  }

  /**
   * @param {float} x
   * @param {float} y
   * @param {float} Brightness Optional
   * @returns {number} Temperature ranges [1000..6600]
   */
  static HelperXYtoColortemperature(x, y, Brightness) {
    let RGB;

    RGB = Huepi.HelperXYtoRGB(x, y, Brightness);
    return Huepi.HelperRGBtoColortemperature(RGB.Red, RGB.Green, RGB.Blue);
  }

  /**
   * @param {number} Temperature ranges [1000..6600]
   * @returns {object} [x, y] - Ranges [0..1] [0..1]
   */
  static HelperColortemperaturetoXY(Temperature) {
    let RGB;

    RGB = Huepi.HelperColortemperaturetoRGB(Temperature);
    return Huepi.HelperRGBtoXY(RGB.Red, RGB.Green, RGB.Blue);
  }

  /**
   * @param {number} CT in Mired (micro reciprocal degree)
   * @returns {number} ColorTemperature
   */
  static HelperCTtoColortemperature(CT) {
    return Math.round(1000000 / CT);
  }

  /**
   * @param {number} ColorTemperature
   * @returns {number} CT in Mired (micro reciprocal degree)
   */
  static HelperColortemperaturetoCT(Temperature) {
    return Math.round(1000000 / Temperature);
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Light Functions
  //
  //

  /**
   * @param {number} LightNr - LightNr
   * @returns {string} LightId
   */
  LightGetId(LightNr) {
    if (typeof LightNr === 'number') {
      if (LightNr <= this.LightIds.length) {
        return this.LightIds[LightNr - 1];
      }
    }
    return LightNr;
  }

  /**
   * @param {string} LightId - LightId
   * @returns {number} LightNr
   */
  LightGetNr(LightId) {
    if (typeof LightId === 'string') {
      return this.LightIds.indexOf(LightId) + 1;
    }
    return LightId;
  }

  /**
   */
  LightsGetData() {
  // GET /api/username/lights
    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username + '/lights').then((response) => {
        return response.data;
      }).then((data) => {
        if (data) {
          this.Lights = data;
          this.LightIds = [];
          for (let key in this.Lights) {
            this.LightIds.push(key);
          }
          resolve(data);
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  /**
   */
  LightsSearchForNew() {
  // POST /api/username/lights
    return Huepi.http.post('http://' + this.BridgeIP + '/api/' + this.Username + '/lights');
  }

  /**
   */
  LightsGetNew() {
  // GET /api/username/lights/new
    return Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username + '/lights/new');
  }

  /**
   * @param {number} LightNr
   * @param {string} Name New name of the light Range [1..32]
   */
  LightSetName(LightNr, Name) {
  // PUT /api/username/lights
    return Huepi.http.put('http://' + this.BridgeIP + '/api/' + this.Username + '/lights/' + this.LightGetId(LightNr),
      {"name" : Name} );
  }

  /**
   * @param {number} LightNr
   * @param {HuepiLightstate} State
   */
  LightSetState(LightNr, State) {
  // PUT /api/username/lights/[LightNr]/state
    if (this.Lights[this.LightGetId(LightNr)]) { // Merge in Cache
      console.log(' Light SetState', this.Lights[this.LightGetId(LightNr)].state);
      var NewState = new HuepiLightstate(this.Lights[this.LightGetId(LightNr)].state);
      this.Lights[this.LightGetId(LightNr)].state = NewState.Merge(State);
      console.log(' LightState Set', this.Lights[this.LightGetId(LightNr)].state.Get());
    } // Merge in Cache
    return Huepi.http.put('http://' + this.BridgeIP + '/api/' + this.Username + '/lights/' + this.LightGetId(LightNr) + '/state',
      State.Get() );
  }

  /**
   * @param {number} LightNr
   * @param {number} Transitiontime optional
   */
  LightOn(LightNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.On();
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * @param {number} LightNr
   * @param {number} Transitiontime optional
   */
  LightOff(LightNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.Off();
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * Sets Gamut Corrected values for HSB
   * @param {number} LightNr
   * @param {number} Hue Range [0..65535]
   * @param {number} Saturation Range [0..255]
   * @param {number} Brightness Range [0..255]
   * @param {number} Transitiontime optional
   */
  LightSetHSB(LightNr, Hue, Saturation, Brightness, Transitiontime) {
    let HueAng = Hue * 360 / 65535;
    let Sat = Saturation / 255;
    let Bri = Brightness / 255;

    let Color = Huepi.HelperHueAngSatBritoRGB(HueAng, Sat, Bri);
    let Point = Huepi.HelperRGBtoXY(Color.Red, Color.Green, Color.Blue);

    return Promise.all([
      this.LightSetBrightness(LightNr, Brightness, Transitiontime),
      this.LightSetXY(LightNr, Point.x, Point.y, Transitiontime)
    ]);
  }

  /**
   * @param {number} LightNr
   * @param {number} Hue Range [0..65535]
   * @param {number} Transitiontime optional
   */
  LightSetHue(LightNr, Hue, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.SetHue(Hue);
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * @param {number} LightNr
   * @param Saturation Range [0..255]
   * @param {number} Transitiontime optional
   */
  LightSetSaturation(LightNr, Saturation, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.SetSaturation(Saturation);
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * @param {number} LightNr
   * @param Brightness Range [0..255]
   * @param {number} Transitiontime optional
   */
  LightSetBrightness(LightNr, Brightness, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.SetBrightness(Brightness);
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * @param {number} LightNr
   * @param Ang Range [0..360]
   * @param Sat Range [0..1]
   * @param Bri Range [0..1]
   * @param {number} Transitiontime optional
   */
  LightSetHueAngSatBri(LightNr, Ang, Sat, Bri, Transitiontime) {
  // In: Hue in Deg, Saturation, Brightness 0.0-1.0 Transform To Philips Hue Range...
    while (Ang < 0) {
      Ang = Ang + 360;
    }
    Ang = Ang % 360;
    return this.LightSetHSB(LightNr, Ang / 360 * 65535, Sat * 255, Bri * 255, Transitiontime);
  }

  /**
   * @param {number} LightNr
   * @param Red Range [0..1]
   * @param Green Range [0..1]
   * @param Blue Range [0..1]
   * @param {number} Transitiontime optional
   */
  LightSetRGB(LightNr, Red, Green, Blue, Transitiontime) {
    let Point = Huepi.HelperRGBtoXY(Red, Green, Blue);
    let HueAngSatBri = Huepi.HelperRGBtoHueAngSatBri(Red, Green, Blue);

    return Promise.all([
      this.LightSetBrightness(LightNr, HueAngSatBri.Bri * 255),
      this.LightSetXY(LightNr, Point.x, Point.y, Transitiontime)
    ]);
  }

  /**
   * @param {number} LightNr
   * @param {number} CT micro reciprocal degree
   * @param {number} Transitiontime optional
   */
  LightSetCT(LightNr, CT, Transitiontime) {
    let Model = this.Lights[this.LightGetId(LightNr)].modelid;

    if (Huepi.HelperModelCapableCT(Model)) {
      let State;

      State = new HuepiLightstate();
      State.SetCT(CT);
      State.SetTransitiontime(Transitiontime);
      return this.LightSetState(LightNr, State);
    } // else if (Huepi.HelperModelCapableXY(Model)) {
    // hue CT Incapable Lights: CT->RGB->XY to ignore Brightness in RGB}
    let Color = Huepi.HelperColortemperaturetoRGB(Huepi.HelperCTtoColortemperature(CT));
    let Point = Huepi.HelperRGBtoXY(Color.Red, Color.Green, Color.Blue);

    return this.LightSetXY(LightNr, Point.x, Point.y, Transitiontime);
  }

  /**
   * @param {number} LightNr
   * @param {number} Colortemperature Range [2200..6500] for the 2012 model
   * @param {number} Transitiontime optional
   */
  LightSetColortemperature(LightNr, Colortemperature, Transitiontime) {
    return this.LightSetCT(LightNr, Huepi.HelperColortemperaturetoCT(Colortemperature), Transitiontime);
  }

  /**
   * @param {number} LightNr
   * @param {float} X
   * @param {float} Y
   * @param {number} Transitiontime optional
   */
  LightSetXY(LightNr, X, Y, Transitiontime) {
    let Model = this.Lights[this.LightGetId(LightNr)].modelid;

    if (Huepi.HelperModelCapableXY(Model)) {
      let State;

      State = new HuepiLightstate();
      let Gamuted = Huepi.HelperGamutXYforModel(X, Y, Model);

      State.SetXY(Gamuted.x, Gamuted.y);
      State.SetTransitiontime(Transitiontime);
      return this.LightSetState(LightNr, State);
    } // else if (Huepi.HelperModelCapableCT(Model)) {
    // hue XY Incapable Lights: XY->RGB->CT to ignore Brightness in RGB
    let Color = Huepi.HelperXYtoRGB(X, Y);
    let Colortemperature = Huepi.HelperRGBtoColortemperature(Color.Red, Color.Green, Color.Blue);

    return this.LightSetColortemperature(LightNr, Colortemperature, Transitiontime);
  }

  /**
   * @param {number} LightNr
   * @param {number} Transitiontime optional
   */
  LightAlertSelect(LightNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.AlertSelect();
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * @param {number} LightNr
   * @param {number} Transitiontime optional
   */
  LightAlertLSelect(LightNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.AlertLSelect();
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * @param {number} LightNr
   * @param {number} Transitiontime optional
   */
  LightAlertNone(LightNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.AlertNone();
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * @param {number} LightNr
   * @param {number} Transitiontime optional
   */
  LightEffectColorloop(LightNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.EffectColorloop();
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  /**
   * @param {number} LightNr
   * @param {number} Transitiontime optional
   */
  LightEffectNone(LightNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.EffectNone();
    State.SetTransitiontime(Transitiontime);
    return this.LightSetState(LightNr, State);
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Group Functions
  //
  //

  /**
   * @param {number} GroupNr - GroupNr
   * @returns {string} GroupId
   */
  GroupGetId(GroupNr) {
    if (typeof GroupNr === 'number') {
      if (GroupNr === 0) {
        return '0';
      } else if (GroupNr > 0) {
        if (GroupNr <= this.GroupIds.length) {
          return this.GroupIds[GroupNr - 1];
        }
      }
    }
    return GroupNr;
  }

  /**
   * @param {string} GroupId - GroupId
   * @returns {number} GroupNr
   */
  GroupGetNr(GroupId) {
    if (typeof GroupId === 'string') {
      return this.GroupIds.indexOf(GroupId) + 1;
    }
    return GroupId;
  }

  /**
   */
  GroupsGetData() {
  // GET /api/username/groups
    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username + '/groups').then((response) => {
        return response.data;
      }).then((data) => {
        if (data) {
          this.Groups = data;
          this.GroupIds = [];
          for (let key in this.Groups) {
            this.GroupIds.push(key);
          }
          resolve(data);
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  /**
   */
  GroupsGetZero() {
  // GET /api/username/groups/0
    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username + '/groups/0').then((response) => {
        return response.data;
      }).then((data) => {
        if (data) {
          this.Groups['0'] = data;
          resolve(data);
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  /**
   * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
   * @param {string} Name New name of the light Range [1..32]
   * @param {multiple} Lights LightNr or Array of Lights to Group
   */
  GroupCreate(Name, Lights) {
  // POST /api/username/groups
    return Huepi.http.put('http://' + this.BridgeIP + '/api/' + this.Username + '/groups/',
      {"name": Name, "lights": Lights} );
  }

  /**
   * @param {number} GroupNr
   * @param {string} Name New name of the light Range [1..32]
   */
  GroupSetName(GroupNr, Name) {
  // PUT /api/username/groups/[GroupNr]
    return Huepi.http.put('http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + this.GroupGetId(GroupNr),
      {"name": Name} );
  }

  /**
   * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
   * @param {number} GroupNr
   * @param {multiple} Lights LightNr or Array of Lights to Group
   */
  GroupSetLights(GroupNr, Lights) {
  // PUT /api/username/groups/[GroupNr]
    return Huepi.http.put('http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + this.GroupGetId(GroupNr),
      {"lights": Lights} );
  }

  /**
   * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
   * @param {number} GroupNr
   * @param {number} LightNr
   */
  GroupHasLight(GroupNr, LightNr) {
    if (this.GroupGetId(GroupNr) != '0') {
      if (this.Groups[this.GroupGetId(GroupNr)].lights.indexOf(this.LightGetId(LightNr))>=0) {
        return true;
      }
    }
    return false;
  }

  /**
   * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
   * @param {number} GroupNr
   * @param {number} LightNr
   */
  GroupRemoveLight(GroupNr, LightNr) {
    if (this.GroupHasLight(GroupNr, this.LightGetId(LightNr))) {
      this.Groups[this.GroupGetId(GroupNr)].lights.splice(
        this.Groups[this.GroupGetId(GroupNr)].lights.indexOf(this.LightGetId(LightNr)), 1);
      this.GroupSetLights(this.GroupGetId(GroupNr), this.Groups[this.GroupGetId(GroupNr)].lights);
    }
  }

  /**
   * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
   * @param {number} GroupNr
   * @param {number} LightNr
   */
  GroupToggleLight(GroupNr, LightNr) {
    if (this.GroupHasLight(GroupNr, this.LightGetId(LightNr))) {
      this.GroupRemoveLight(GroupNr, LightNr);
    } else {
      this.GroupAddLight(GroupNr, LightNr);
    }
  }

  /**
   * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
   * @param {number} GroupNr
   * @param {number} LightNr
   */
  GroupAddLight(GroupNr, LightNr) {
    if (!this.GroupHasLight(GroupNr, this.LightGetId(LightNr))) {
      this.Groups[this.GroupGetId(GroupNr)].lights.push(this.LightGetId(LightNr));
      this.GroupSetLights(this.GroupGetId(GroupNr), this.Groups[this.GroupGetId(GroupNr)].lights);
    }
  }

  /**
   * Note: Bridge doesn't accept lights in a Group that are unreachable at moment of creation
   * @param {number} GroupNr
   * @param {string} Name New name of the light Range [1..32]
   * @param {multiple} Lights LightNr or Array of Lights to Group
   */
  GroupSetAttributes(GroupNr, Name, Lights) {
  // PUT /api/username/groups/[GroupNr]
    return Huepi.http.put('http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + this.GroupGetId(GroupNr),
      {"name": Name, "lights":Lights} );
  }

  /**
   * @param {number} GroupNr
   */
  GroupDelete(GroupNr) {
  // DELETE /api/username/groups/[GroupNr]
    return Huepi.http.delete('http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + this.GroupGetId(GroupNr));
  }

  /**
   * @param {number} GroupNr
   * @param {HuepiLightstate} State
   */
  GroupSetState(GroupNr, State) {
  // PUT /api/username/groups/[GroupNr]/action
    if (this.Groups[this.GroupGetId(GroupNr)]) { // Merge in Cache
      console.log(' Group SetState', this.Groups[this.GroupGetId(GroupNr)].action);
      var NewState = new HuepiLightstate(this.Groups[this.GroupGetId(GroupNr)].action);
      this.Groups[this.GroupGetId(GroupNr)].action = NewState.Merge(State);
      console.log(' GroupState Set', this.Groups[this.GroupGetId(GroupNr)].action.Get());
    } // Merge in Cache
    return Huepi.http.put('http://' + this.BridgeIP + '/api/' + this.Username + '/groups/' + this.GroupGetId(GroupNr) + '/action', 
     State.Get() );
  }

  /**
   * @param {number} GroupNr
   * @param {number} Transitiontime optional
   */
  GroupOn(GroupNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.On();
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param {number} Transitiontime optional
   */
  GroupOff(GroupNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.Off();
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * Sets Gamut Corrected values for HSB
   * @param {number} GroupNr
   * @param {number} Hue Range [0..65535]
   * @param {number} Saturation Range [0..255]
   * @param {number} Brightness Range [0..255]
   * @param {number} Transitiontime optional
   */
  GroupSetHSB(GroupNr, Hue, Saturation, Brightness, Transitiontime) {
    let Ang = Hue * 360 / 65535;
    let Sat = Saturation / 255;
    let Bri = Brightness / 255;

    let Color = Huepi.HelperHueAngSatBritoRGB(Ang, Sat, Bri);
    let Point = Huepi.HelperRGBtoXY(Color.Red, Color.Green, Color.Blue);

    return Promise.all([
      this.GroupSetBrightness(GroupNr, Brightness, Transitiontime),
      this.GroupSetXY(GroupNr, Point.x, Point.y, Transitiontime)
    ]);
  }

  /**
   * @param {number} GroupNr
   * @param {number} Hue Range [0..65535]
   * @param {number} Transitiontime optional
   */
  GroupSetHue(GroupNr, Hue, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.SetHue(Hue);
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param Saturation Range [0..255]
   * @param {number} Transitiontime optional
   */
  GroupSetSaturation(GroupNr, Saturation, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.SetSaturation(Saturation);
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param Brightness Range [0..255]
   * @param {number} Transitiontime optional
   */
  GroupSetBrightness(GroupNr, Brightness, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.SetBrightness(Brightness);
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param Ang Range [0..360]
   * @param Sat Range [0..1]
   * @param Bri Range [0..1]
   * @param {number} Transitiontime optional
   */
  GroupSetHueAngSatBri(GroupNr, Ang, Sat, Bri, Transitiontime) {
    while (Ang < 0) {
      Ang = Ang + 360;
    }
    Ang = Ang % 360;
    return this.GroupSetHSB(GroupNr, Ang / 360 * 65535, Sat * 255, Bri * 255, Transitiontime);
  }

  /**
   * @param {number} GroupNr
   * @param Red Range [0..1]
   * @param Green Range [0..1]
   * @param Blue Range [0..1]
   * @param {number} Transitiontime optional
   */
  GroupSetRGB(GroupNr, Red, Green, Blue, Transitiontime) {
    let HueAngSatBri = Huepi.HelperRGBtoHueAngSatBri(Red, Green, Blue);

    return this.GroupSetHueAngSatBri(GroupNr, HueAngSatBri.Ang, HueAngSatBri.Sat, HueAngSatBri.Bri, Transitiontime);
  }

  /**
   * @param {number} GroupNr
   * @param {number} CT micro reciprocal degree
   * @param {number} Transitiontime optional
   */
  GroupSetCT(GroupNr, CT, Transitiontime) {
    let Lights = [];

    GroupNr = this.GroupGetId(GroupNr);
    if (GroupNr === '0') { // All Lights
      Lights = this.LightIds;
    } else {
      Lights = this.Groups[GroupNr].lights;
    }

    if (Lights.length !== 0) {
      let deferreds = [];

      for (let LightNr = 0; LightNr < Lights.length; LightNr++) {
        deferreds.push(this.LightSetCT(Lights[LightNr], CT, Transitiontime));
      }
      return Promise.all(deferreds); // return Deferred when with array of deferreds
    }
    // No Lights in Group GroupNr, Set State of Group to let Bridge create the API Error and return it.
    let State;

    State = new HuepiLightstate();
    State.SetCT(CT);
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param {number} Colortemperature Range [2200..6500] for the 2012 model
   * @param {number} Transitiontime optional
   */
  GroupSetColortemperature(GroupNr, Colortemperature, Transitiontime) {
    return this.GroupSetCT(GroupNr, Huepi.HelperColortemperaturetoCT(Colortemperature), Transitiontime);
  }

  /**
   * @param {number} GroupNr
   * @param {float} X
   * @param {float} Y
   * @param {number} Transitiontime optional
   */
  GroupSetXY(GroupNr, X, Y, Transitiontime) {
    let Lights = [];

    GroupNr = this.GroupGetId(GroupNr);
    if (GroupNr === '0') { // All Lights
      Lights = this.LightIds;
    } else {
      Lights = this.Groups[GroupNr].lights;
    }

    if (Lights.length !== 0) {
      let deferreds = [];

      for (let LightNr = 0; LightNr < Lights.length; LightNr++) {
        deferreds.push(this.LightSetXY(Lights[LightNr], X, Y, Transitiontime));
      }
      return Promise.all(deferreds); // return Deferred when with array of deferreds
    }
    // No Lights in Group GroupNr, Set State of Group to let Bridge create the API Error and return it.
    let State;

    State = new HuepiLightstate();
    State.SetXY(X, Y);
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param {number} Transitiontime optional
   */
  GroupAlertSelect(GroupNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.AlertSelect();
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param {number} Transitiontime optional
   */
  GroupAlertLSelect(GroupNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.AlertLSelect();
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param {number} Transitiontime optional
   */
  GroupAlertNone(GroupNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.AlertNone();
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param {number} Transitiontime optional
   */
  GroupEffectColorloop(GroupNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.EffectColorloop();
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  /**
   * @param {number} GroupNr
   * @param {number} Transitiontime optional
   */
  GroupEffectNone(GroupNr, Transitiontime) {
    let State;

    State = new HuepiLightstate();
    State.EffectNone();
    State.SetTransitiontime(Transitiontime);
    return this.GroupSetState(GroupNr, State);
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Schedule Functions
  //
  //

  /**
   */
  SchedulesGetData() {
  // GET /api/username/schedules
    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username + '/schedules').then((response) => {
        return response.data;
      }).then((data) => {
        if (data) {
          this.Schedules = data;
          resolve(data);
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Scenes Functions
  //
  //

  /**
   */
  ScenesGetData() {
  // GET /api/username/scenes
    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username + '/scenes').then((response) => {
        return response.data;
      }).then((data) => {
        if (data) {
          this.Scenes = data;
          resolve(data);
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Sensors Functions
  //
  //

  /**
   */
  SensorsGetData() {
  // GET /api/username/sensors
    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username + '/sensors').then((response) => {
        return response.data;
      }).then((data) => {
        if (data) {
          this.Sensors = data;
          resolve(data);
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

  // //////////////////////////////////////////////////////////////////////////////
  //
  // Rules Functions
  //
  //

  /**
   */
  RulesGetData() {
  // GET /api/username/rules
    return new Promise((resolve, reject) => {
      Huepi.http.get('http://' + this.BridgeIP + '/api/' + this.Username + '/rules').then((response) => {
        return response.data;
      }).then((data) => {
        if (data) {
          this.Rules = data;
          resolve(data);
        } else {
          reject(data);
        }
      }).catch(function (message) { // fetch failed
        reject(message);
      });
    });
  }

}

Huepi.http = null;
if (typeof axios !== 'undefined') {
  Huepi.http = axios.create();
}
exports.Huepi = Huepi;
exports.HuepiLightstate = HuepiLightstate;

}) (typeof exports !== 'undefined' ? exports : this);
