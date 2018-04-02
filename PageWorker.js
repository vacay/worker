/* global require, module, process, setTimeout, clearTimeout */

var uuid = require('uuid')
var domain = require('domain')
var config = require('config-worker')
var async = require('async')
var db = require('db')(config)
var log = require('log')(config.log)

var PageUpdater = function() {
  return {
    worker: uuid.v4() + ':' + process.pid,

    init: function() {
      log.debug('worker:', this.name);
      this.queue = async.queue(this._run.bind(this), 1);
      this.queue.drain = this._check.bind(this);
      this._check();
    },

    _check: function() {
      var self = this;
      log.debug('checking for pages...');

      var checkLater = function() {
	setTimeout(function() {
	  self._check();
	}, 10000);
      };

      var now = new Date();
      var q = db.knex('pages').select();
      q.innerJoin('subscriptions', 'pages.id', 'subscriptions.prescriber_id');
      q.where(function() {
	this.where('is_static', false);
	this.andWhere('updating_agent', null);
	this.andWhere('updating_started_at', null);
	var hourAgo = new Date(now.setTime(now.getTime() - 3600000));
	this.andWhere('pages.updated_at', '<', hourAgo);
      });
      q.orWhere(function() {
	var tenMinsAgo = new Date(now.setTime(now.getTime() - 600000));
	this.where('updating_started_at', '<', tenMinsAgo);
      }).then(function(pages) {
	log.debug('found:', pages.length);

	if (!pages.length) {
	  checkLater();
	  return;
	}

	self.queue.push(pages);
      }).catch(function(err) {
	log.error(err);
	checkLater();
      });
    },
    _run: function(page, done) {
      var self = this;
      var timeout = setTimeout(function() {
	done('page update timeout', page);
      }, 180000);

      self._update(page, function(err) {
	clearTimeout(timeout)
	self._finish(err, page, done);
      });
    },
    _update: function(page, cb) {
      log.debug('updating: ', page.url);
      var d = domain.create();

      d.on('error', function(err) {
	cb(err)
      })

      d.run(function() {
	db.model('Page').findOrCreate(page.url, cb);
      })
    },
    _finish: function(err, page, cb) {
      log.debug('finishing: ', page.url);
      var params = {};
      if (err) {
	//silence network errors
	var NETWORK_ERRORS = ['ECONNRESET', 'ENOTFOUND', 'ESOCKETTIMEDOUT', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'EPIPE', 'EAI_AGAIN'];
	if (NETWORK_ERRORS.indexOf(err.code) === -1)
	  log.error(err, page);
	params.update_failures = page.update_failures || 0;
	params.update_failures++;
      } else {
	params.update_at = new Date();
      }

      db.knex('pages').update(params).where('id', page.id).asCallback(cb);
    }
  };
};

module.exports = PageUpdater;
