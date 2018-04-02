/* global require, module */

var ytdl = require('youtube-dl'),
    request = require('request'),
    fs = require('fs'),
    URI = require('urijs'),
    config = require('config-worker'),
    s3 = require('s3'),
    querystring = require('querystring');

var s3client = s3.createClient({
    s3Options: {
	accessKeyId: config.s3.key,
	secretAccessKey: config.s3.secret
    }
});


var amazon = function (remote, local, callback) {

    var params = {
	localFile: local,
	s3Params: {
	    Bucket: config.s3.bucket,
	    Key: querystring.unescape(remote.split('.com/').pop())
	}
    };

    var dl = s3client.downloadFile(params);

    dl.on('error', function(err) {
	callback(err);
    });

    dl.on('end', function() {
	callback(null);
    });  
};

var direct = function (remote, local, callback) {

    request.get(remote).on('error', function(err) {
	callback(err);
    }).on('end', function() {
	callback(null);
    }).pipe(fs.createWriteStream(local));
};

var extractor = function (remote, local, callback) {

    var video = ytdl(remote, ['--format=bestaudio']);

    video.on('info', function(info) {
	video.pipe(fs.createWriteStream(local));
    });

    video.on('end', function() {
	callback(null);
    });

    video.on('error', function(err) {
	callback(err);
    });
};

module.exports = {
    S3: amazon,
    youtubedl: extractor,
    remote: direct
};
