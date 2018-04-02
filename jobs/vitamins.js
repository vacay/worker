/* global require, module */

var config = require('config-worker'),
    db = require('db')(config),
    uuid = require('uuid'),
    async = require('async'),
    fs = require('fs'),
    log = require('log')(config.log),
    download = require('../modules/download'),
    ffmpeg = require('fluent-ffmpeg'),
    querystring = require('querystring'),
    s3 = require('s3'),
    codegen = require('../modules/codegen'),
    domain = require('domain');

var s3client = s3.createClient({
    s3Options: {
	accessKeyId: config.s3.key,
	secretAccessKey: config.s3.secret
    }
});

var extension = {
    mp3: '.mp3',
    aac: '.mp4'
};

/*
 job.data.url
 job.data.stream_url
 job.data.vitamin_id
 job.data.host
 job.data.host_id
*/
var vitaminTask = function (job, ctx, done) {
    var vitaminPath = config.tmp + '/' + job.id + '.download';

    var duration, bitrate, codec;

    async.waterfall([

	function (callback) {

	    log.debug('[ ' + job.id + ' ] downloading...');

	    switch (job.data.host) {
	    case 'hypem':
		download.youtubedl(job.data.url, vitaminPath, callback);
		break;
            case 'youtube':
		download.youtubedl(job.data.url, vitaminPath, callback);
		break;
            case 'vacay':
		download.S3(job.data.url, vitaminPath, callback);
		break;
            default:
		download.remote(job.data.stream_url, vitaminPath, callback);
		break;
	    }
	},

	function(callback) {
	    ffmpeg(vitaminPath).ffprobe(function(err, metadata) {
		if (err) {
		    callback(err);
		    return;
		}

		if (!metadata.streams && !metadata.streams.length) {
		    callback('metadata missing streams');
		    return;
		}

		for (var i=0; i<metadata.streams.length; i++) {
		    if (metadata.streams[i].codec_type === 'audio') {
			codec = metadata.streams[i].codec_name;
			duration = Math.round(metadata.streams[i].duration);
			bitrate = Math.round(metadata.streams[i].bit_rate / 1000);
			break;
		    }
		}

		if (!extension[codec]) {
		    callback('unsupported codec: ' + codec);
		    return;
		}

		if (duration > 1200) {
		    callback('duration too long: ' + duration);
		    return;
		}

		var oldPath = vitaminPath;
		vitaminPath = vitaminPath + extension[codec];

		fs.rename(oldPath, vitaminPath, callback);
	    });
	},

	function(callback) {

	    log.debug('[ ' + job.id + ' ] uploading vitamin...');

	    var params = {
		localFile: vitaminPath,
		s3Params: {
		    Bucket: config.s3.bucket,
		    Key: config.s3.folder + '/vitamins/' + job.data.vitamin_id + extension[codec]
		}
	    };

	    var uploader = s3client.uploadFile(params);

	    uploader.on('error', function(err) {
		callback(err);
	    });

	    uploader.on('end', function() {
		callback();
	    });
	},

	function(callback) {
	    db.model('Vitamin').update({
		id: job.data.vitamin_id,
		processed_at: new Date(),
		duration: duration
	    }).asCallback(callback);
	},

	function(vitamin, callback) {

	    var host = {
		bitrate: bitrate,
		codec: codec
	    };

	    if (job.data.host === 'vacay') {
		var newUrl = 'https://s3.amazonaws.com/' +
			config.s3.bucket +
			'/' +
			config.s3.folder +
			'/vitamins/' +
			job.data.vitamin_id + extension[codec];
		host.url = newUrl;
		host.stream_url = newUrl;
	    }

	    db.knex('hosts').where({
		title: job.data.host,
		identifier: job.data.host_id,
		vitamin_id: job.data.vitamin_id
	    }).update(host).asCallback(callback);
	}

    ], function (processingError) {

	if (processingError) log.error(processingError);

	async.parallel({

	    vitamin: function(callback) {
		if (fs.existsSync(vitaminPath)) {
		    fs.unlink(vitaminPath, callback);
		} else {
		    callback();
		}
	    },

	    upload: function(callback) {
		if (job.data.host === 'vacay' && !processingError) {

		    var key = querystring.unescape(job.data.url.split('.com/').pop());

		    var params = {
			Bucket: config.s3.bucket,
			Delete: {
			    Objects: [{ Key: key }]
			}
		    };

		    var deleter = s3client.deleteObjects(params);

		    deleter.on('error', function(err) {
			callback(err);
		    });

		    deleter.on('end', function() {
			callback();
		    });

		} else {
		    callback();
		}
	    }

	}, function(postProcessingError, results) {

	    if (postProcessingError) log.error(postProcessingError);

	    log.debug('[ ' + job.id + ' ] ending job...');

	    done(processingError, {
		id: job.data.vitamin_id
	    });

	});
    });
};

module.exports.init = function (queue) {
    queue.process('vitamin', function(job, ctx, done) {

	var d = domain.create();

	d.on('error', function(err) {
	    log.error(err, job.id, job.data);
	    done(err);
	});

	d.run(function() {
	    vitaminTask(job, ctx, done);
	});

    });
};
