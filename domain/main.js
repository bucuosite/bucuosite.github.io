/*! http://mths.be/fromcodepoint v0.1.0 by @mathias */
if (!String.fromCodePoint) {
  (function() {
    var defineProperty = (function() {
      // IE 8 only supports `Object.defineProperty` on DOM elements
      try {
        var object = {};
        var $defineProperty = Object.defineProperty;
        var result = $defineProperty(object, object, object) && $defineProperty;
      } catch(error) {}
      return result;
    }());
    var stringFromCharCode = String.fromCharCode;
    var floor = Math.floor;
    var fromCodePoint = function() {
      var MAX_SIZE = 0x4000;
      var codeUnits = [];
      var highSurrogate;
      var lowSurrogate;
      var index = -1;
      var length = arguments.length;
      if (!length) {
        return '';
      }
      var result = '';
      while (++index < length) {
        var codePoint = Number(arguments[index]);
        if (
          !isFinite(codePoint) ||       // `NaN`, `+Infinity`, or `-Infinity`
          codePoint < 0 ||              // not a valid Unicode code point
          codePoint > 0x10FFFF ||       // not a valid Unicode code point
          floor(codePoint) != codePoint // not an integer
        ) {
          throw RangeError('Invalid code point: ' + codePoint);
        }
        if (codePoint <= 0xFFFF) { // BMP code point
          codeUnits.push(codePoint);
        } else { // Astral code point; split in surrogate halves
          // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
          codePoint -= 0x10000;
          highSurrogate = (codePoint >> 10) + 0xD800;
          lowSurrogate = (codePoint % 0x400) + 0xDC00;
          codeUnits.push(highSurrogate, lowSurrogate);
        }
        if (index + 1 == length || codeUnits.length > MAX_SIZE) {
          result += stringFromCharCode.apply(null, codeUnits);
          codeUnits.length = 0;
        }
      }
      return result;
    };
    if (defineProperty) {
      defineProperty(String, 'fromCodePoint', {
        'value': fromCodePoint,
        'configurable': true,
        'writable': true
      });
    } else {
      String.fromCodePoint = fromCodePoint;
    }
  }());
}

;(function()
{
	'use strict';
	/** Highest positive signed 32-bit float value */
	var maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	var base = 36;
	var tMin = 1;
	var tMax = 26;
	var skew = 38;
	var damp = 700;
	var initialBias = 72;
	var initialN = 128; // 0x80
	var delimiter = '-'; // '\x2D'

	/** Regular expressions */
	var regexPunycode = /^xn--/;
	var regexNonASCII = /[^\x20-\x7E]/; // unprintable ASCII chars + non-ASCII chars
	var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

	/** Error messages */
	var errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	};

	/** Convenience shortcuts */
	var baseMinusTMin = base - tMin;
	var floor = Math.floor;
	var stringFromCharCode = String.fromCharCode;

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new Error(errors[type]);
	}
	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	//var ucs2encode = array => String.fromCodePoint(...array);

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	var basicToDigit = function(codePoint) {
		if (codePoint - 0x30 < 0x0A) {
			return codePoint - 0x16;
		}
		if (codePoint - 0x41 < 0x1A) {
			return codePoint - 0x41;
		}
		if (codePoint - 0x61 < 0x1A) {
			return codePoint - 0x61;
		}
		return base;
	};
	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	var digitToBasic = function(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	};

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	var adapt = function(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	};
	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	var  decodeXN = function(input) {
		// Don't use UCS-2.
		var output = [];
		var inputLength = input.length;
		var i = 0;
		var n = initialN;
		var bias = initialBias;

		// Handle the basic code points: var `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		var basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (var j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (var index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			var oldi = i;
			for (var w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				var digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				var t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				var baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			var out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output.
			output.splice(i++, 0, n);

		}

		//return String.fromCodePoint(...output);
		return String.fromCodePoint.apply(null, output);
	};

	window.decodeXN = decodeXN;

})();

	function checkIsPC()
	{
	    var userAgent = navigator.userAgent.toLowerCase();
	    var mobile = ["android", "iphone","windows phone"];
	    for (var i=0; i<mobile.length; i++) if(userAgent.indexOf(mobile[i]) >= 0) return false;
	    return true;
	}

	var getXNName = function()
	{
		var temp = location.href.split('.')[0].replace(/^http:\/\//g, '');
		if(temp.indexOf('xn--')<0) return '黄婷婷';
		return decodeXN(temp.replace(/^xn--/g, ''));
	};
	var isMobile = !checkIsPC();
	var peopleName = getXNName();
	var sampleName = '张小伟';
	var G = function(id){return document.getElementById(id);};
	document.title = peopleName + '我爱你';
	G('target_1').setAttribute('href', 'http://'+peopleName+'.我爱你');
	G('target_1').innerHTML = 'http://'+peopleName+'.我爱你';
	G('target_2').innerHTML = peopleName+'.我爱你';
	G('target_3').innerHTML = peopleName;
	G('target_4').innerHTML = peopleName;
	G('target_5').innerHTML = peopleName+'.我爱你';
	G('target_6').setAttribute('href', 'https://wanwang.aliyun.com/nametrade/detail/online.html?domainName='+encodeURI(peopleName+'.我爱你'));
	G('sample_1').innerHTML = sampleName;
	G('sample_2').innerHTML = '--'+sampleName + '宣';
	
	function init()
	{
		G('page_wrapper').style.display = 'block';
		var runPage = new FullPage(
		{
			id : 'page_wrapper',
			slideTime : 800,
			continuous : true,// create an infinite feel with no endpoints
			effect :
			{
				transform :
				{
					translate : 'Y',					   // 'X'|'Y'|'XY'|'none'
					scale : [.1, 1],					   // [scalefrom, scavaro]
					rotate : [isMobile?0:270, 0]					   // [rotatefrom, rotateto]
				},
				opacity : [0, 1]                           // [opacityfrom, opacityto]
			},
			mode : 'wheel,touch,nav:navBar',               // mode of fullpage
			easing : 'ease',                                // easing('ease','ease-in','ease-in-out' or use cubic-bezier like [.33, 1.81, 1, 1] )
			callback : function(index, thisPage)
			{
				
			}
		});
		G('loading_wrapper').style.display = 'none';
		document.getElementsByTagName('section')[0].style.display = 'block';
		initMusic();
		initTongji();

	}
	function toggleMusic()
	{
		var a = G('music_wrapper');
		if(a.className.indexOf('stop') >= 0)
		{
			a.className = '';
			music.play();
		}
		else
		{
			a.className = 'stop';
			music.pause();
		}
	}
	function initMusic()
	{
		window.music = new Audio('http://bucuo.site/domain/music.mp3');
		music.loop=true;
		music.play();
	}

	function initTongji()
	{
		if(!siteId) return; // 如果没有配置百度统计也可以直接放行
		window._hmt = window._hmt || [];
		(function() {
		  var hm = document.createElement("script");
		  hm.src = "http://hm.baidu.com/hm.js?"+siteId;
		  var s = document.getElementsByTagName("script")[0]; 
		  s.parentNode.insertBefore(hm, s);
		})();
	}

	var pinyins = 
	{
		'黄婷婷': ['huangtingting', '08c2afd5967136ddf228cce9f56182b8'],//ok
		'孙芮': ['sunrui', '49e13a28947599244b51340f131ddb46'],//ok
		'王子文': ['wangziwen', ''],
		'谢霆锋': ['xietingfeng', ''],
		'王心凌': ['wangxinling', ''],
		'杨丞琳': ['yangchenglin', 'c775ba6530ecd7e0d918fcbf2405da47'],
		'张韶涵': ['zhangshaohan', '']
	};
	var enName = (pinyins[peopleName] || pinyins['黄婷婷'])[0];
	var siteId = (pinyins[peopleName] || [])[1];
	var tempImg = new Image();
	tempImg.onload = function()
	{
		setTimeout(init, 1000);
	};
	tempImg.onerror = function()
	{
		setTimeout(init, 1000);
	};
	tempImg.src = 'http://bucuo.site/domain/'+enName+'/1.jpg';
	

	var tempStyle = document.createElement('style');
	tempStyle.innerHTML = '.page1{background-image:url(http://bucuo.site/domain/'+enName+'/1.jpg);}'+
							'.page2{background-image:url(http://bucuo.site/domain/'+enName+'/2.jpg);}'+
							'.page3{background-image:url(http://bucuo.site/domain/'+enName+'/3.jpg);}';
	document.head.appendChild(tempStyle);
