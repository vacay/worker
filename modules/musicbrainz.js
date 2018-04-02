var request = require('requestretry');
var xml2js = require('xml2js');

var mbBaseURI = 'http://musicbrainz.org/ws/2/';

var search = function(resource, query, filter, cb) {

    var filterArr = [],
	filterStr = '',
	uri = mbBaseURI + resource + '?',
	uriToAdd = '';

    // Go through the rest of the filters
    if (filter instanceof Object) {
	for(var key in filter){
	    if (key === 'limit' || key === 'offset') {
		uriToAdd += !uriToAdd.length ? '' : '&';
		uriToAdd += key + '=' + filter[key];
	    } else {
		filterArr.push(key + ':' + encodeURIComponent(filter[key]));
	    }
	}
	filterStr = filterArr.join( encodeURIComponent(' AND ') );
    }

    // Set query
    uriToAdd += !uriToAdd.length ? '' : '&';
    uriToAdd += 'query=';

    if(query && query.length > 0 && filterStr.length > 0){
	uriToAdd += encodeURIComponent(query.replace(/'/g, '%27').replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1')) + encodeURIComponent(' AND ') + filterStr;
    } else if(!query || query.length === 0){
	uriToAdd += filterStr;
    } else {
	uriToAdd += encodeURIComponent(query.replace(/'/g, '%27').replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1'));
    }

    // Finally add to the uri
    uri += uriToAdd || '';

    request({
	url: uri,
	maxAttempts: 3,
	rejectUnauthorized: false
    }, function(err, res, body) {

	if (err) {
	    cb(err, null);
	    return;
	}

	//TODO - If the service is busy, we'll try again later
	var parser = new xml2js.Parser();

	if (!err && res.statusCode === 200) {
	    parser.addListener('end', function(result) {
		cb(false, result);
	    });
	    parser.parseString(body);

	} else {
	    parser.addListener('end', function(result) {
		var err = new Error(result.text);
		err.statusCode = res.statusCode;
		cb(err, null);
	    });
	    parser.parseString(body);
	}

    });

};

module.exports = {
    search: search
};
