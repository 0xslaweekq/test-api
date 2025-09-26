# start bash -i ./start.sh
# alias defpass="echo 'YOUR_DOCKER_PASS"
# alias doccon="docker login -u YOUR_DOCKER_USER_NAME --password-stdin"
# defpass | doccon

docker buildx build -t slaweekq/test_api:latest --push .
docker compose -p test_api stop || true
docker compose -p test_api down -v && docker compose -p test_api rm -sfv

echo "My image: slaweekq/test_api:latest"
