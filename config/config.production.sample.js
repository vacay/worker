module.exports = {
  debug: true,
  tmp: '/path/to/tmp',
  port: 8000,
  pageUpdaterHostname: 'worker0',
  echonest_key: '',
  elasticsearch: {
    hosts: [
      '',
      ''
    ]
  },
  s3: {
    key: '',
    secret: '',
    bucket: 'vacay',
    folder: 'production'
  },

  log: {
    level: 'debug'
  },

  mysql: {
    database: 'vacay_production',
    host: '',
    port: 3306,
    user: '',
    password: '',
    charset  : 'UTF8_GENERAL_CI'
  },


  queue: {
    redis: {
      host: '',
      port: 6379,
      options: {
	auth_pass: ''
      }
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
