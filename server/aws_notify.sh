#!/bin/bash

source /home/ec2-user/.bash_profile

export DB_CONNECTION_STRING=$(aws ssm get-parameters --region ca-central-1 --output text --names epyc-DB_CONNECTION_STRING --with-decryption --query Parameters[0].Value)
export DISCORD_BOT_TOKEN=$(aws ssm get-parameters --region ca-central-1 --output text --names epyc-DISCORD_BOT_TOKEN --with-decryption --query Parameters[0].Value)

cd /home/www/epyc
node .build/sendNotifications.js
