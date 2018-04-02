module.exports = {
  debug: true,
  tmp: path.join(__dirname, '/../../tmp'),
  port: 8001,
  url: 'http://localhost:9000',
  pageUpdaterHostname: 'hostname.local',
  echonest_key: '',
  ses: {
    key: '',
    secret: ''
  },
  elasticsearch: {
    hosts: [
      'http://localhost:9200'
    ]
  },
  s3: {
    key: '',
    secret: '',
    bucket: 'vacay',
    folder: 'development'
  },

  log: {
    level: 'debug'
  },

  mysql: {
    database: 'vacay_development',
    host: 'localhost',
    port: 3306,
    user: 'root',
    charset  : 'UTF8_GENERAL_CI'
  },


  queue: {
    redis: {
      host: '127.0.0.1',
      port: 6379
    },
    disableSearch: true
  },

  smtp: {
    service: '',
    auth: {
      user: '',
      pass: ''
    }
  }

};
