#!/bin/bash

# start bash -i ./start.sh
# alias defpass="echo 'YOUR_DOCKER_PASS"
# alias doccon="docker login -u YOUR_DOCKER_USER_NAME --password-stdin"
# defpass | doccon
docker pull slaweekq/test_api:latest
docker compose -p test_api stop || true
docker compose -p test_api down -v && docker compose -f ./docker-compose.* rm -sfv
# docker rmi $(docker images -q --no-trunc) || true
docker compose -f ./docker-compose.* -p test_api up -d

echo "Server started"
IP=$(curl api.ipify.org)
echo "################################################################"
echo Done! Create an A-type entry in your domain control panel, targeting $IP
echo "################################################################"
