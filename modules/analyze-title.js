var config = require('config-worker');
var log = require('log')(config);
var request = require('requestretry');
var async = require('async');
var types = require('./variation-types');


// situations to address
// "vs" in artist part

//if variation in first part -> first part is title, second is artist
//if variation in second part -> first part is artist, second is title
//if variation in neither part -> first part is artist, second is title
//if variation in both part -> wtf??

function getParts(string) {
    if (string) {
	var count = 0;
	var tmp = string;
	var pos = tmp.search(/\s-\s/);


	while (pos !== -1) { 
	    count ++;
	    tmp = tmp.substr(pos + 1);
	    pos = tmp.search(/\s-\s/);
	}


	if (count === 1 && /\s-\s/.test(string)) {
	    pos = string.indexOf('-');

	    var featuredRegex = /featuring|ft|feat[.\s]/i;
	    var paranthesisRegex = /[\(|\[]([^)\]]*)/g;

	    var featuredStrings = [];
	    var variationStrings = [];
	    var type = [];

	    var part1 = string.substring(0, pos).replace(/\s{2,}/g, ' ').replace(/(^\s+|\s+$)/g, '');
	    var p1Inside = part1.match(paranthesisRegex);
	    var p1Outside = part1.replace(paranthesisRegex, '');

	    if (p1Inside) {
		for (var p1=0; p1<p1Inside.length; p1++) {
		    if (featuredRegex.test(p1Inside[p1])) {
			var o = p1Inside[p1].split(featuredRegex);
			featuredStrings.push(o);
		    } else {
			variationStrings.push(p1Inside[p1]);
		    }
		}
	    }
	    
	    if (featuredRegex.test(p1Outside)) {
		var g = p1Outside.split(featuredRegex);
		p1Outside = g.shift();
		featuredStrings.push(g.pop());
	    }

	    var part2 = string.substring(pos + 1).replace(/\s{2,}/g, ' ').replace(/(^\s+|\s+$)/g, '');
	    var p2Inside = part2.match(paranthesisRegex);
	    var p2Outside = part2.replace(paranthesisRegex, '');

	    if (p2Inside) {
		for (var p2=0; p2<p2Inside.length; p2++) {
		    if (featuredRegex.test(p2Inside[p2])) {
			var o2 = p2Inside[p2].split(featuredRegex);
			featuredStrings.push(o);
		    } else {
			variationStrings.push(p2Inside[p2]);
		    }
		}
	    }

	    if (featuredRegex.test(p2Outside)) {
		var c = p2Outside.split(featuredRegex);
		p2Outside = c.shift();
		featuredStrings.push(c.pop());
	    }

	    if (variationStrings.length) {
		var variationString = variationStrings.join(' ')
			.replace(/\(/g, '')
			.replace(/\[/g, '')
			.replace(/\s{2,}/g, ' ');

		var i=0;

		while (variationString.length && i<types.length) {
		    if (variationString.search(types[i].regex) >= 0) {
			variationString = variationString.replace(types[i].regex, '');
			type.push(types[i].title);
		    }

		    i++;
		}
	    }

	    return {
		artist: p1Outside,
		featured: featuredStrings.join(' '),
		title: getOriginalTitle(part2).split(featuredRegex).shift(),
		variation: variationString,
		type: type
	    };
	} else {
	    return {
		artist: null,
		featured: null,
		title: string,
		variation: null,
		type: null
	    };
	}

    } else {
	return {
	    artist: null,
	    featured: null,
	    title: null,
	    variation: null,
	    type: null
	};
    }
}

function clean(string) {

    // considerations:
    // - premiere

    return string.replace(/\bfree\sdownload\b/ig, '')
	.replace(/\free\sdl\slink/ig, '')
	.replace(/\bdownload\b/ig, '')
	.replace(/\bout\snow\b/ig, '')
	.replace(/\exclusive\b/ig, '')
	.replace(/\bcoming\ssoon\b/ig, '');

}

function getArtists(string, echonest_key, callback) {
    if (!string) {
	log.debug('empty artist string');
	callback(null, []);
	return;
    }

    log.debug('echonest extract artist request: ', string);
    request({
	url: 'http://developer.echonest.com/api/v4/artist/extract?' + [
	    'api_key=' + echonest_key,
	    'text=' + encodeURIComponent(string)
	].join('&'),
	json: true,
	maxAttempts: 3,
	rejectUnauthorized: false
    }, function(err, response, body) {
	callback(err, body && body.response && body.response.artists ? body.response.artists : []);
    });
}

function getOriginalTitle(string) {
    var idx = string.search(/\(/ig);

    if (idx >= 0) {
	return string.substr(0, idx)
	    .replace(/\[\]/g, '')
	    .replace(/\s{2,}/g, ' ')
	    .replace(/(^\s+|\s+$)/g, '');
    } else {
	return string;
    };
}

module.exports = function(title, echonest_key, callback) {

    log.debug('analyze title: ', title);

    var cleaned = clean(title);
    log.debug('cleaned title: ', cleaned);

    var parts = getParts(cleaned);
    log.debug('broke title into parts: ', parts);

    async.parallel({

	artists: function(next) {
	    getArtists(parts.artist, echonest_key, next);
	},
	
	variationArtists: function(next) {
	    getArtists(parts.variation, echonest_key, next);
	},

	featuredArtists: function(next) {
	    getArtists(parts.featured, echonest_key, next);
	}

    }, function(err, results) {

	var result = {
	    string: title,
	    cleaned: cleaned,
	    original: parts.title,
	    artists: results.artists,
	    featured: results.featuredArtists,
	    variation: {
		string: parts.variation,
		types: parts.type,
		artists: results.variationArtists
	    }
	};

	callback(err, result);

    });
};
