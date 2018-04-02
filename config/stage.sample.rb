require	'toquen'
require '.toquen_creds'



Toquen::AWSProxy.new.server_details.each do |details|

  if details[:roles].include? 'web'

    server details[:external_ip], roles: %w{web app db}

  end

end



set :applicationdir, "/home/opbandit/webapp"
set :rails_env, "production"
set :branch, 'master'

before "deploy:finished", "delayed_job:restart"
