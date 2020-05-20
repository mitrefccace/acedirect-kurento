FROM ubuntu:bionic

RUN apt-get update && \
  apt-get install --no-install-recommends --yes \
  git gnupg devscripts equivs ca-certificates

RUN apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 5AFA7A83

RUN echo "deb [arch=amd64] http://ubuntu.openvidu.io/dev bionic kms6" > etc/apt/sources.list.d/kurento.list

RUN apt-get update

WORKDIR /

RUN git version

RUN git clone "https://github.com/Kurento/kms-omni-build.git"

WORKDIR /kms-omni-build

RUN git submodule update --init --recursive && \
    git submodule update --remote

RUN git checkout 6.11.0 && \
    git submodule foreach "git checkout 6.11.0 || true"

COPY install-deps.sh ./
RUN bash install-deps.sh

EXPOSE 8888
EXPOSE 8433

COPY run-kurento.sh ./
CMD [ "bash" ]