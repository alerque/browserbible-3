

/******************
ReaderSettings
*******************/

var AppSettings = (function() {
	// create me
	function getValue(key, defaultValue) {


		key = sofia.config.settingsPrefix + key;


		sofia.config.debug && console.info('getValue', key, defaultValue);

		var returnValue = {},
			storedValue = null;


		// put all default values on the value object
		for (var objkey in defaultValue) {
			returnValue[objkey] = defaultValue[objkey];
		}

		sofia.config.debug && console.info('default', returnValue);

		// require localStorage (no cookies!)
		if (typeof window.localStorage == 'undefined') {
			return returnValue;
		}

		storedValue = window.localStorage[key];

		sofia.config.debug && console.info('storedValue', 'key:' + key, storedValue);

		if (storedValue == null) {
			return returnValue;
		} else {
			try {
				storedValue = JSON.parse(storedValue);
			} catch (ex) {

			}
		}

		sofia.config.debug && console.info('storedValue', storedValue);

		for (var objkey in storedValue) {
			returnValue[objkey] = storedValue[objkey];
		}

		sofia.config.debug && console.info('combined', returnValue);

		return returnValue;
	}

	function setValue(key, value) {

		key = sofia.config.settingsPrefix + key;

		if (typeof window.localStorage != 'undefined') {

			sofia.config.debug && console.info('STORE', 'key:' + key, value);

			window.localStorage[key] = JSON.stringify(value);
		}
	}
	
	/* From QuirksMode */
	function getCookieValue(name) {
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for(var i = 0; i < ca.length; i++) {
			var c = ca[i];
			while (c.charAt(0) == ' ') c = c.substring(1, c.length);
			if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
		}
		return null;		
	}

	return {
		getValue: getValue,
		setValue: setValue,
		getCookieValue: getCookieValue
	}

})();
