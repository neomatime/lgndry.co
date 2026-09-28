select cron.schedule(
  'cleanup-enquiry-upload-sessions',
  '17 * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'enquiry_cleanup_project_url'
      ) || '/functions/v1/cleanup-enquiry-upload-sessions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'enquiry_cleanup_secret_key'
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $job$
);
