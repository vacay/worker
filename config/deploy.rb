require_relative 'aws_creds'

# Set the location of your SSH key.  You can give a list of files, but
# the first key given will be the one used to upload your chef files to
# each server.
set :ssh_options, {
  :user => 'deploy', # overrides user setting above
  :forward_agent => true,
  :auth_methods => %w(publickey)
}

# Set the location of your cookbooks/data bags/roles for Chef
set :chef_cookbooks_path, 'kitchen/cookbooks'
set :chef_data_bags_path, 'kitchen/data_bags'
set :chef_roles_path, 'kitchen/roles'
set :chef_nodes_path, 'kitchen/nodes'
set :chef_environments_path, 'kitchen/environment'

set :application, 'vacay'
set :repo_url, 'git@github.com:vacay/worker.git'

set :deploy_to, '/home/deploy/worker'
set :pty, true

set :default_env, { 'NODE_ENV' => 'production' }
set :keep_releases, 2

set :use_sudo, true

set :pm2_app_process, 'process.json'
set :pm2_app_name, 'worker'
set :pm2_env_variables, {}

namespace :pm2 do
  desc 'Install pm2 & logrotate'
  task :install do
    on roles(:worker), in: :parallel do
      execute "sudo npm install pm2 -g"
      execute "sudo pm2 logrotate -u deploy"
      execute "sudo pm2 set pm2-logrotate:retain 50"
    end
  end

  desc 'Restart app gracefully'
  task :restart do
    on roles(:worker), in: :parallel do
      case app_status
      when nil
        info 'App is not registerd'
        invoke 'pm2:start'
      when 'stopped'
        info 'App is stopped'
        restart_app
      when 'errored'
        info 'App has errored'
        restart_app
      when 'online'
        info 'App is online'
        restart_app
      end
    end
  end

  after 'deploy:published', 'pm2:restart'

  desc 'List all pm2 applications'
  task :status do
    run_task :pm2, :list
  end

  desc 'Start pm2 application'
  task :start do
    run_task :pm2, :start, fetch(:pm2_app_process)
  end

  desc 'Stop pm2 application'
  task :stop do
    run_task :pm2, :stop, app_name
  end

  desc 'Delete pm2 application'
  task :delete do
    run_task :pm2, :delete, app_name
  end

  desc 'Show pm2 application info'
  task :list do
    run_task :pm2, :show, app_name
  end

  desc 'Watch pm2 logs'
  task :logs do
    run_task :pm2, :logs
  end

  desc 'Reset pm2 meta data'
  task :reset do
    run_task :pm2, :reset, app_name
  end

  desc 'Save pm2 state so it can be loaded after restart'
  task :save do
    run_task :pm2, :save
  end

  desc 'Reload pm2 Logs'
  task :reloadLogs do
    run_task :pm2, :reloadLogs
  end

  def app_name
    fetch(:pm2_app_name)
  end

  def app_status
    within current_path do
      ps = JSON.parse(capture :pm2, :jlist, :'-s')

      # find the process with our app name
      ps.each do |child|
        if child['name'] == app_name
          # status: online, errored, stopped
          return child['pm2_env']['status']
        end
      end

      return nil
    end
  end

  def restart_app
    within current_path do
      execute :pm2, :restart, app_name
    end
  end

  def run_task(*args)
    on roles(:worker), in: :parallel do
      within fetch(:pm2_target_path, current_path) do
        with fetch(:pm2_env_variables) do
          execute *args
        end
      end
    end
  end
end

namespace :npm do
  desc 'Symlink app npm modules to shared path'
  task :symlink do
    on roles(:worker), in: :parallel do
      execute "mkdir -p #{shared_path}/node_modules"
      execute "rm -rf #{release_path}/node_modules && ln -s #{shared_path}/node_modules/ #{release_path}/node_modules"
    end
  end

  desc 'Install app npm modules'
  task :install do
    on roles(:worker), in: :parallel do
      execute "cd #{release_path}/ && sudo npm install --production"
    end
  end

  after 'deploy:updated', 'npm:symlink'
  after 'deploy:updated', 'npm:install'
end
