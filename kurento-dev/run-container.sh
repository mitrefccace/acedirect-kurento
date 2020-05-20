#!/bin/bash

IMAGE=mitre/kurento-dev
CONTAINER=kurento-build

if [ ! -d "kms-omni-build" ]; then
  git clone "https://github.com/Kurento/kms-omni-build.git"
  cd kms-omni-build

  git submodule update --init --recursive
  git submodule update --remote

  git checkout 6.11.0
  git submodule foreach "git checkout 6.11.0 || true"
  cd ..
fi
cp run-kurento.sh build.sh kms-omni-build

docker build -t $IMAGE .

docker inspect $CONTAINER > /dev/null
RES=$?

if [ $RES == '0' ]; then
  docker start -ia $CONTAINER
else
  docker run -it \
    --mount "type=bind,src=$(pwd)/kms-omni-build,dst=/kms-omni-build" \
    --name $CONTAINER -p 8888:8888 -p 8433:8433 $IMAGE bash
fi