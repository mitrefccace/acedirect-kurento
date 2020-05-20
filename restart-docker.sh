docker stop $(docker ps -q)
docker rm $(docker ps -a -q)
docker build -t agonza1/acedirect-kurento .
docker run -p 8443:8443 -d agonza1/acedirect-kurento
docker exec -it agonza1/acedirect-kurento npm run sequelize db:migrate
docker logs --follow $(docker ps -q | awk '{print $1;}')
