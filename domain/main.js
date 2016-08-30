;(function()
{
	'use strict';
	/** Highest positive signed 32-bit float value */
	const maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	const base = 36;
	const tMin = 1;
	const tMax = 26;
	const skew = 38;
	const damp = 700;
	const initialBias = 72;
	const initialN = 128; // 0x80
	const delimiter = '-'; // '\x2D'

	/** Regular expressions */
	const regexPunycode = /^xn--/;
	const regexNonASCII = /[^\x20-\x7E]/; // unprintable ASCII chars + non-ASCII chars
	const regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

	/** Error messages */
	const errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	};

	/** Convenience shortcuts */
	const baseMinusTMin = base - tMin;
	const floor = Math.floor;
	const stringFromCharCode = String.fromCharCode;

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}
	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	const ucs2encode = array => String.fromCodePoint(...array);

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	const basicToDigit = function(codePoint) {
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
	const digitToBasic = function(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	};

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	const adapt = function(delta, numPoints, firstTime) {
		let k = 0;
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
		const output = [];
		const inputLength = input.length;
		let i = 0;
		let n = initialN;
		let bias = initialBias;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		let basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (let j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (let index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			let oldi = i;
			for (let w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				const digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				const t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				const baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			const out = output.length + 1;
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

		return String.fromCodePoint(...output);
	};

	window.decodeXN = decodeXN;

})();



var getXNName = function()
{
	var temp = location.href.split('.')[0].replace(/^http:\/\//g, '');
	if(temp.indexOf('xn--')<0) return '杨丞琳';
	return decodeXN(temp.replace(/^xn--/g, ''));
};

	var peopleName = getXNName();
	var sampleName = '张小伟';
	var G = function(id){return document.getElementById(id);};
	function init()
	{
		
		
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
					scale : [.1, 1],					   // [scalefrom, scaleto]
					rotate : [270, 0]					   // [rotatefrom, rotateto]
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
		initMusic();
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
		window.music = new Audio('music.mp3');
		music.play();
	}

	document.querySelector('.page1').style.backgroundImage = 'url(http://bucuo.site/domain/'+peopleName+'/1.jpg)';
	document.querySelector('.page2').style.backgroundImage = 'url(http://bucuo.site/domain/'+peopleName+'/2.jpg)';
	document.querySelector('.page3').style.backgroundImage = 'url(http://bucuo.site/domain/'+peopleName+'/3.jpg)';
	window.onload = function()
	{
		setTimeout(init, 1500);
	};
