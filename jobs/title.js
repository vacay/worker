/* global module, require */

var async = require('async');
var mb = require('musicbrainz');
var domain = require('domain');
var config = require('config-worker');
var db = require('db')(config);
var log = require('log')(config.log);
var analyzeTitle = require('../modules/analyze-title');

var titleJob = function(job, ctx, done) {
    analyzeTitle(job.data.vitaminTitle, config.echonest_key, function(err, result) {
	if (err) {
	    done(err);
	    return;
	}

	var isVariation = result.variation.artists.length ? true : false;

	var addArtist = function(artist, attributed, type, cb) {

	    log.debug('adding %s %s %s', attributed ? 'attributed' : 'unattributed', type, artist.name);

	    db.model('Artist').findOrCreate({
		echonest: artist.id,
		name: artist.name
	    }, function(err, artist) {
		if (err) {
		    cb(err);
		    return;
		}

		db.knex('artists_vitamins').insert({
		    vitamin_id: job.data.id,
		    artist_id: artist.id,
		    attributed: attributed,
		    type: type
		}).asCallback(function(err, rows) {
		    if (err) {
			cb(err);
			return;
		    }

		    cb();
		});
	    });
	};

	async.series({

	    reset: function(cb) {
		db.knex('artists_vitamins').del().where('vitamin_id', job.data.id).asCallback(cb);
	    },

	    artists: function(cb) {
		async.each(result.artists, function(artist, next) {
		    addArtist(artist, !isVariation, 'Original', next);
		}, cb);
	    },

	    featured: function(cb) {
		async.each(result.featured, function(artist, next) {
		    addArtist(artist, true, 'Featured', next);
		}, cb);
	    },

	    variation: function(cb) {
		async.each(result.variation.artists, function(artist, next) {
		    addArtist(artist, isVariation, 'Variation', next);
		}, cb);
	    },

	    releases: function(cb) {
		mb.searchRecordings(job.data.vitaminTitle, {}, cb);
	    }

	}, function(err, results) {

	    if (err) {
		done(err);
		return;
	    }

	    var artists = [];
	    for (var a=0; a<result.artists.length; a++) {
		artists.push(result.artists[a].name);
	    }

	    var featured = [];
	    for (var f=0; f<result.featured.length; f++) {
		featured.push(result.featured[f].name);
	    }

	    var variationArtists = [];
	    for (var r=0; r<result.variation.artists.length; r++) {
		variationArtists.push(result.variation.artists[r].name);
	    }

	    var artistString = artists.join();
	    var featuringString = featured.length ? 'ft. ' + featured.join() : null;
	    var variationArtistString = variationArtists.length ? variationArtists.join() : null;
	    var variationTypeString = result.variation.types ? result.variation.types.join(' ') : null;

	    var title = [];
	    title.push(artistString);

	    if (featuringString) title.push(featuringString);

	    title.push('-', result.original);

	    if (variationTypeString || variationArtistString) {
		var variationString = '(';
		if (variationArtistString) variationString += variationArtistString + ' ';
		variationString += variationTypeString + ')';
		title.push(variationString);
	    }

	    log.debug('title: ', title.join(' '));

	    db.knex('vitamins').update({
		title: title.join(' '),
		original: result.original,
		variation: variationTypeString,
		mbid: results.releases.length ? results.releases[0].id : null
	    }).where({
		id: job.data.id
	    }).asCallback(done);
	});
    });
};

module.exports.init = function(queue) {
    queue.process('title', function(job, ctx, done) {

	var d = domain.create();

	d.on('error', function(err) {
	    log.error(err, job.data);
	    done(err);
	});

	d.run(function() {
	    titleJob(job, ctx, done);
	});

    });
};
