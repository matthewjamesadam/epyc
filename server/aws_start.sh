#!/bin/bash

source /home/ec2-user/.bash_profile

export DB_CONNECTION_STRING=$(aws ssm get-parameters --region ca-central-1 --output text --names epyc-DB_CONNECTION_STRING --with-decryption --query Parameters[0].Value)
export DISCORD_BOT_TOKEN=$(aws ssm get-parameters --region ca-central-1 --output text --names epyc-DISCORD_BOT_TOKEN --with-decryption --query Parameters[0].Value)
export SLACK_REQUEST_SIGNING_SECRET=$(aws ssm get-parameters --region ca-central-1 --output text --names epyc-SLACK_REQUEST_SIGNING_SECRET --with-decryption --query Parameters[0].Value)
export SLACK_CLIENT_ID=$(aws ssm get-parameters --region ca-central-1 --output text --names epyc-SLACK_CLIENT_ID --with-decryption --query Parameters[0].Value)
export SLACK_CLIENT_SECRET=$(aws ssm get-parameters --region ca-central-1 --output text --names epyc-SLACK_CLIENT_SECRET --with-decryption --query Parameters[0].Value)
export PORT=3001

cd /home/www/epyc
pm2 start .build/server.js --name epyc
