/* global __dirname, require, module */

var fs = require('fs');
var path = require('path');

var config;
var config_file = '/home/deploy/apps.json';

if (fs.existsSync(config_file)) {

  config = JSON.parse(fs.readFileSync(config_file));

  var db = config.servers.filter(function(s) {
    return s.normal.toquen.roles.indexOf('db') > -1;
  })[0];

  var monitor = config.servers.filter(function(s) {
    return s.normal.toquen.roles.indexOf('monitor') > -1;
  })[0];

  var elasticsearch = config.servers.filter(function(s) {
    return s.normal.toquen.roles.indexOf('search') > -1;
  });

  var elasticsearch_hosts = [];
  for (var e=0; e<elasticsearch.length; e++) {
    elasticsearch_hosts.push(elasticsearch[e].internal_ip + ':9200');
  }

  config.elasticsearch = {
    hosts: elasticsearch_hosts
  };

  config.mysql.host = db.normal.toquen.internal_ip;
  config.redis.host = monitor.internal_ip;
  config.queue = {
    redis: config.redis,
    disableSearch: true
  };

} else if (process.env.NODE_ENV === 'production') {

  config = require('./config.production')

} else {

  config = require('./config.development')

}

if (!config) {
  throw new Error('Application config missing');
}

module.exports = config;
