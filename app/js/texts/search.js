// truth AND Love
// 1. load indexes
// 2. find verses with both terms
// 3. reduce to chapters
// 4. load chapters
// 5. extract verses


// truth OR love
// 1. load indexes
// 2. merge lists of verses into canonical order
// 3. reduce to chapters
// 4. load chapters
// 5. extract verses


// "in truth"
// 1. load indexes
// 2. ...
// 3. reduce to chapters
// 4. load chapters
// 5. extract verses


// truth love
// 1. NO INDEX
// 2. load every chapter
// 3. use regexp to find verses with words

var singleWordLanguages = ['cht','chs','chi','zho','cmn', 'jpn', 'kor'];

TextSearch = function() {

	var
		baseContentPath = sofia.config.baseContentUrl + 'content/' + 'texts/',
		isSearching = false,
		canceled = false,
		searchText = '',
		searchTextid = '',
		//isAsciiRegExp = new RegExp('^[\040-\176]*$', 'gi'),
		isLemmaRegExp = /[GgHh]\d{1,6}/g,

		isLemmaSearch = false,
		startTime = null,

		searchTermsRegExp = [],
		searchIndexLoader = new SearchIndexLoader(),
		searchIndexesData = [],
		searchIndexesCurrentIndex = 0,

		searchType = 'AND',

		searchFinalResults = [];
		;

	searchIndexLoader.on('complete', indexesLoaded);

	function start(text, textid) {

		sofia.config.debug && console.info('TextSearch.start', text, textid);

		if (isSearching) {
			sofia.config.debug && console.info('already started ... return');
			return false;
		}
		isSearching = true;

		// store variables
		searchText = text;
		searchTextid = textid;
		textInfo = TextLoader.getText(searchTextid);


		// reset
		canceled = false;
		startTime = new Date();
		searchFinalResults = [];
		searchTermsRegExp = [];
		searchIndexesData = []
		searchIndexesCurrentIndex = 0;
		searchType = /\bOR\b/gi.test(text) ? 'OR' : 'AND';

		//createSearchTerms();
		isLemmaSearch = isLemmaRegExp.test(searchText);
		searchTermsRegExp = SearchTools.createSearchTerms(text, isLemmaSearch);

		if (sofia.config.serverSearchPath != '' && (window.location.protocol != 'file:' || sofia.config.baseContentUrl != '')) {

			startServerSearch(textInfo, searchText, isLemmaSearch);
		} else {
			// load indexes
			searchIndexLoader.loadIndexes(textInfo, searchText, isLemmaSearch);
		}

		return true;
	}

	function startServerSearch(textInfo, searchText, isLemmaSearch) {

		$.ajax({
			dataType: 'jsonp',
			url: sofia.config.baseContentUrl + sofia.config.serverSearchPath,
			data: {
				textid: textInfo.id,
				search: searchText.toLowerCase(),
				date: (new Date()).toString()
			},
			success: function(data) {

				// create results
				if (data && data.results) {
					for (var i=0, il=data.results.length; i<il; i++) {
						var result = data.results[i],
							fragmentid = Object.keys(result)[0],
							html = result[fragmentid];


						var result = findMatchesInVerse(html);

						if (result.foundMatch) {
							searchFinalResults.push({fragmentid: fragmentid, html: result.html});
						}

						// add to results
						//searchFinalResults.push({fragmentid: fragmentid, html: html});
					}


					ext.trigger('complete', {type: 'complete', target:this, data: {results: searchFinalResults, searchIndexesData: searchIndexesData, searchTermsRegExp: searchTermsRegExp, isLemmaSearch: isLemmaSearch}});


				} else {

					ext.trigger('complete', {type: 'complete', target: this, data: {results: null, searchIndexesData: searchIndexesData, searchTermsRegExp: searchTermsRegExp, isLemmaSearch: isLemmaSearch}});


				}



				isSearching = false;
			},
			error: function(a,b,c,d) {
				sofia.config.debug && console.log('error:serverSearch', a,b,c,d);
				//reset()
			}
		})
	}

	// fires after indexer loader is done
	function indexesLoaded(e) {
		sofia.config.debug && console.info('searchIndexLoader:complete', e.data);

		if (e.data.loadedIndexes.length == 0) {

			// BRUTE FORCE?
			sofia.config.debug && console.info('BRUTE FORCE');

			// create "index" of all verses?
			searchIndexesData = [];
			for (var i=0, il = textInfo.sections.length; i<il; i++) {
				var sectionid = textInfo.sections[i],
					dbsBookCode = sectionid.substr(0,2),
					chapterNumber = parseInt(sectionid.substr(2), 10),
					sectionData = {
						sectionid: sectionid,
						fragmentids: []
					};

				for (v=1; v<=bible.BOOK_DATA[dbsBookCode].chapters[chapterNumber-1]; v++ ) {
					sectionData.fragmentids.push(sectionid + '_' + v);
				}


				searchIndexesData.push(sectionData);
			}

			loadNextSectionid();



			/*
			isSearching = false;
			ext.trigger('indexerror', {type: 'indexerror', target:this, data: {results: searchFinalResults}});
			*/

		} else {
			ext.trigger('indexcomplete', {type: 'indexcomplete', target:this, data: {searchIndexesData: e.data.loadedResults }});

			// begin loading


			searchIndexesData = e.data.loadedResults;
			searchIndexesCurrentIndex = -1;

			sofia.config.debug && console.info('start loading indexes', searchIndexesData.length, searchIndexesCurrentIndex);
			loadNextSectionid();
		}

	}

	function loadNextSectionid() {
		searchIndexesCurrentIndex++;

		////console.log('loadNextSectionid', searchIndexesData.length, searchIndexesCurrentIndex);

		if (searchIndexesCurrentIndex > searchIndexesData.length) {

			sofia.config.debug && console.info('OVER');

			isSearching = false;

		} else if (searchIndexesCurrentIndex == searchIndexesData.length) {
			// DONE!

			sofia.config.debug && console.info('textSearch:complete');

			ext.trigger('complete', {type: 'complete', target:this, data: {results: searchFinalResults, searchIndexesData: searchIndexesData, searchTermsRegExp: searchTermsRegExp, isLemmaSearch: isLemmaSearch}});

			isSearching = false;

		} else {
			var sectionData = searchIndexesData[searchIndexesCurrentIndex],
				sectionid = sectionData ? sectionData.sectionid : null,
				fragmentids = sectionData ? sectionData.fragmentids : null;
				;// url = baseContentPath + textInfo.id + '/' + sectionid + '.json';

			if (!sectionData) {
				loadNextSectionid();
				return;
			}

			ext.trigger('load', {type: 'load', target:this, data: {sectionid: sectionid, index: searchIndexesCurrentIndex, total: searchIndexesData.length}});

			TextLoader.loadSection(textInfo, sectionid, function(content) {

				for (var i=0, il=fragmentids.length; i<il; i++) {
					var
						fragmentid = fragmentids[i],
						fragmentNode = content.find('.' + fragmentid).clone(),

						// assuming a single node
						//html = fragmentNode.html();

						html = '';

					// remove notes
					fragmentNode.find('.note, .cf, .v-num, .verse-num').remove();

					// concat verses split over multiple <span class="v"> nodes (paragraphs)
					fragmentNode.each(function(i,el) {
						html += $(el).html() + ' ';
					});

					if (fragmentNode.length > 0) {

						var result = findMatchesInVerse(html);

						if (result.foundMatch) {
							searchFinalResults.push({fragmentid: fragmentid, html: result.html});
						}
					}
				}


				// DEBUG!!
				//setTimeout(function() {
					loadNextSectionid();
				//}, 10);


			}, function(error) {

				sofia.config.debug && console.info('searchindex:error');

				loadNextSectionid();
			});

		}
	}


	function findMatchesInVerse(html) {
		var processedHtml = html,
			foundMatch = false,
			regMatches = new Array(searchTermsRegExp.length);

		for (var j=0, jl=searchTermsRegExp.length; j<jl; j++) {

			searchTermsRegExp[j].lastIndex = 0;

			if (isLemmaSearch) {

				// add the 'highlight' class to the <l> node
				processedHtml = processedHtml.replace(searchTermsRegExp[j], function(match) {
					regMatches[j] = true;
					foundMatch = true;
					return match + ' class="highlight" ';
				});

			} else {

				// surround the word with a highlight
				processedHtml = processedHtml.replace(searchTermsRegExp[j], function(match) {
					regMatches[j] = true;
					foundMatch = true;
					return '<span class="highlight">' + match + '</span>';
				});

			}
		}

		if (searchType == 'AND') {
			var foundAll = true;
			for (var j=0, jl=regMatches.length; j<jl; j++) {
				if (regMatches[j] !== true) {
					foundAll = false;
					break;
				}
			}
			foundMatch = foundAll;

		}

		return {html: processedHtml, foundMatch: foundMatch};
	}




	var ext = {
		start: start,
		findMatchesInVerse: findMatchesInVerse
	};
	ext = $.extend(true, ext, EventEmitter);

	return ext;
};

SearchTools = {

	isAsciiRegExp: new RegExp('^[\040-\176]*$', 'gi'),

	isLemmaRegExp: /[GgHh]\d{1,6}/g,

	createSearchTerms: function (searchText, isLemmaSearch) {
		var searchTermsRegExp = [];

		if (isLemmaSearch) {

			var strongNumbers = searchText.split(' ');

			for (var i=0, il=strongNumbers.length; i<il; i++) {

				var part = strongNumbers[i];

				searchTermsRegExp.push( new RegExp('s=("|\')' + '(G|H)?' + part.substr(1) + '("|\')', 'gi') );

			}

		} else {



			// check for quoted search "jesus christ"
			if (searchText.substring(0,1) == '"' && searchText.substring(searchText.length-1) == '"') {

				var withoutQuotes =  searchText.substring(1,searchText.length-1);
				withoutQuotes = withoutQuotes.replace(/\s/g,'(\\s?(<(.|\\n)*?>)?\\s?)?');

				searchTermsRegExp.push( new XRegExp('\\b(' + withoutQuotes + ')\\b', 'gi') );

			} else {

				// ASCII characters have predictable word boundaries (space ' ' = \b)
				SearchTools.isAsciiRegExp.lastIndex = 0;

				if (SearchTools.isAsciiRegExp.test( searchText )) {

					// for non-quoted searches, use "AND" search
					var andSearchParts = searchText.split(/\s+AND\s+|\s+/gi);

					// filter for duplicate words
					andSearchParts = $.unique(andSearchParts);

					for (var i=0, il=andSearchParts.length; i<il; i++) {

						var part = andSearchParts[i],
							partRegex = new XRegExp('\\b(' + part + ')\\b', 'gi');

						searchTermsRegExp.push( partRegex );
					}

				} else {

					var words = SearchTools.splitWords(searchText);

					for (var j=0, jl=words.length; j<jl; j++) {

						searchTermsRegExp.push( new XRegExp(words[j], 'gi') );

					}
				}
			}
		}

		return searchTermsRegExp;
	},

	splitWords: function(input) {

		var
			removeRegChars = ['\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '[', ']', '{', '}'];
			otherRemoveChars = [
				// roman
				',',';', '!', '-', '–', '―', '—', '~', ':', '"','/', "'s", '’s', "'", '‘', '’', '“', '”', '¿', '<', '>', '&',
				// chinese
				'。', '：', '，', '”', '“', '）', '（', '~', '「', '」'
			],
			punctuation = [].concat(removeRegChars).concat(otherRemoveChars),
			innerWordExceptions = ["'", '’', '-'],
			words = [],
			word = '';

		function addWord() {
			if (word != '')	{
				words.push(word);
			}
			word = '';
		}

		// formalize string
		input = new String(input);

		// yes or no on apostrophes
		input = input.replace(/(['’]s)/gi, '');

	    for (var i = 0, il = input.length; i<il; i++) {
			var	letter = input.charAt(i),
				charCode = input.charCodeAt(i),
				isFirstChar = (i==0);
				isLastChar = (i==il-1),
				isPunctuation = punctuation.indexOf(letter) > -1,
				isWhitespace = letter == ' ',
				isLetter = !(isWhitespace || isPunctuation);

			// if this is a letter
			if ( isLetter ) {

				 word += letter;

				// If this is a Chinese/Japanese/Korean ideograph, it is a word by itself. No separator is needed.
				if (((charCode >= 0x4E00) && (charCode <= 0x9FFF)) || ((charCode >= 0x3400) && (charCode <= 0x4DFF)) || ((charCode >= 0x20000) && (charCode <= 0x2A6DF))) {

	                addWord(); // Technically, some ideographs combine to make a compound word, but concordance/search will work without that refinement, possibly with extra hits.
	            }

			} else if (!isFirstChar && !isLastChar && innerWordExceptions.indexOf(letter) > -1 && punctuation.indexOf(input[i-1]) == -1 && punctuation.indexOf(input[i+1]) == -1) {

				word += letter;

			} else {
				// it was punctuation!
				addWord();
			}

			////console.log(letter, charCode);
	    }

		addWord();

		words = $.unique(words);

		return words;
	},

	HASHSIZE: 20,

	hashWord: function(word) {
	    var hash = 0;
	    for (i = 0; i < word.length; i++) {
	        hash += word.charCodeAt(i);
	        hash %= SearchTools.HASHSIZE;
	   }
	   return hash;
	}
};

SearchIndexLoader = function() {

	var
		baseContentPath = sofia.config.baseContentUrl + 'content/' + 'texts/',
		textInfo = null,
		searchTerms = [],
		searchTermsIndex = -1,
		isLemmaSearch = false,
		// initial load: [{term:'light': occurrences: ['GN1_2', 'GN2_5']}, {term: 'love': ['JN3']}
		loadedIndexes = [],
		// final: [{sectionid:'GN1', fragmentids: ['GN1_2', 'GN1_3']}, {sectionid:'GN2', fragmentids: ['GN2_4']} }
		loadedResults = [],
		searchType = 'AND'; // OR

	// START
	function loadIndexes(newTextInfo, searchText, isLemma) {

		isLemmaSearch = isLemma;
		textInfo = newTextInfo;

		// split up search into words for indexing
		/*
		if (texts.singleWordLanguages.indexOf(textInfo.lang) > -1) {
			searchTerms = [];
			for (var i=0,il=searchText.length; i<il; i++) {
				var text = searchText[i];
				if (text.replace(/\s/gi, '').length > 0) {
					searchTerms.push( text );
				}
			}
		} else {
			searchTerms = searchText.replace(/\sAND\s/gi,' ').replace(/\sOR\s/gi,' ').replace(/"/g,'').split(/\s+/g);
		}
		*/
		searchTerms = SearchTools.splitWords(searchText);

		searchTermsIndex = -1;
		loadedIndexes = [];
		loadedResults = [];

		searchType = /\bOR\b/gi.test(searchText) ? 'OR' : 'AND';

		sofia.config.debug && console.info('SearchIndexLoader:loadIndexes', searchText, searchType, searchTerms, isLemmaSearch);

		// start it up
		loadNextIndex();
	}


	function loadNextIndex() {

		// starts at -1, so this will make the first one 0
		searchTermsIndex++;

		if (searchTermsIndex < searchTerms.length) {

			loadSearchTermIndex( searchTerms[searchTermsIndex] );

		} else {

			// if we've done all the indexes, then it's time to start combining them
			//combineIndexes();
			processIndexes();
		}

	}

	function loadSearchTermIndex(searchTerm) {

		var indexUrl = '',
			key = '';

		if (isLemmaSearch) {
			key = searchTerm.toUpperCase();
			var letter = key.substr(0,1),
				firstNumber = searchTerm.length >= 5 ? searchTerm.substr(1,1) : '0';



			indexUrl = baseContentPath + textInfo.id + '/indexlemma/_' + letter.toUpperCase() + firstNumber + '000' + '.json';

		} else {
			key = searchTerm.toLowerCase();

			//var searchTermEncoded = base32.encode(unescape(encodeURIComponent(searchTerm.toLowerCase())));
			var hash = SearchTools.hashWord(key); //base32.encode(unescape(encodeURIComponent(searchTerm.toLowerCase())));



			indexUrl = baseContentPath + textInfo.id + '/index/_' + hash + '.json';
		}

		if (searchTerm == 'undefined') {
			sofia.config.debug && console.info('STOP search. undefined term');
			return;
		}

		sofia.config.debug && console.info('Loading Index:' + searchTerm + ',' + searchTermEncoded);

		// attempt to load in index
		$.ajax({
			beforeSend: function(xhr){
				if (xhr.overrideMimeType){
					xhr.overrideMimeType("application/json");
				}
			},

			dataType: 'json',
			url: indexUrl,
			success: function(data) {

				var fragments = data[key];

				loadedIndexes.push(fragments);

				loadNextIndex();
			},
			error: function() {
				sofia.config.debug && console.info('no index for: ' + searchTerm);
				loadNextIndex();
			}

		});

	}

	function processIndexes() {

		// we'll combine everything into this ['GN1_1', 'GN1_2']
		fragmentids = [];
		// then pair down to this [{sectionid:'GN1', fragmentids: ['GN1_1','GN1_2']}]
		loadedResults = [];

		if (loadedIndexes.length > 0) {

			if (searchType == 'OR') {
				// combine all the fragments
				for (var i=0, il=loadedIndexes.length; i<il; i++) {
					fragmentids = fragmentids.concat( loadedIndexes[i] ); // .occurrences );
					////console.log(loadedIndexes[i].term);
					////console.log(loadedIndexes[i].occurrences);
				}

				// sort!
				fragmentids.sort(function(a, b) {
					// split into parts
					function splitFragment(fragmentid) {
						var parts = fragmentid.split('_'),
							sectionid = parts[0],
							sectionIndex = textInfo.sections.indexOf(sectionid),
							fragmentNum = parseInt(parts[1], 10),
							value = {
								sectionid: sectionid,
								sectionIndex: sectionIndex,
								fragmentNum: fragmentNum
							};

						return value;
					}

					var fraga = splitFragment(a),
						fragb = splitFragment(b);


					if (fraga.sectionIndex < fragb.sectionIndex ||
						(fraga.sectionIndex == fragb.sectionIndex && fraga.fragmentNum < fragb.fragmentNum) )
						return -1;
					if (fraga.sectionIndex > fragb.sectionIndex ||
						(fraga.sectionIndex == fragb.sectionIndex && fraga.fragmentNum > fragb.fragmentNum) )
						return 1;
					// a must be equal to b
					return 0;
				});


			} else if (searchType == 'AND') {

				// combine arrays to only include fragments (verses) where all indexes overlap (truth AND love)
				var totalIndexes = loadedIndexes.length;
				if (totalIndexes == 1) {
					fragmentids = loadedIndexes[0]; // .occurrences;
				} else if (totalIndexes > 1) {
					//fragmentids = loadedIndexes[0].occurrences.filter(function(val) {
					fragmentids = loadedIndexes[0].filter(function(val) {
						var inOtherArrays = true;
						for (var i=1; i<totalIndexes; i++) {
							//if (loadedIndexes[i].occurrences.indexOf(val) == -1) {
							if (loadedIndexes[i].indexOf(val) == -1) {
								inOtherArrays = false;
								break;
							}
						}

						return inOtherArrays;
					});
				}
			}

			// reformat fragments into sectionids
			// ['JN1_1','JN1_2'] => [{sectionid: 'JN1', fragmentids: ['JN1_1','JN1_2']}]
			if (fragmentids) {
				for (var i=0, il=fragmentids.length; i<il; i++) {
					var fragmentid = fragmentids[i];

					if (fragmentid != '' && fragmentid != null) {


						var	sectionid = fragmentid.split('_')[0],

							// see if we already created data for this section id
							sectionidInfo = $.grep(loadedResults, function(val){ return val.sectionid == sectionid; });

						// create new data
						if (sectionidInfo.length == 0) {
							loadedResults.push({sectionid: sectionid, fragmentids: [fragmentid]});
						}
						// add to this sectionid
						else {
							sectionidInfo[0].fragmentids.push(fragmentid);
						}
					}


				}
			}
		}


		sofia.config.debug && console.info('SearchIndexLoader:processIndexes', 'DONe');
		// send up the chain
		ext.trigger('complete', {type:'complete', target: this, data: {
																	loadedIndexes: loadedIndexes,
																	loadedResults: loadedResults,
																	fragmentids: fragmentids
																}});
	}

	var ext = {
		loadIndexes: loadIndexes
	};
	ext = $.extend(true, ext, EventEmitter);

	return ext;
};
