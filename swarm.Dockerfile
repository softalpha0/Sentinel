FROM node:22-alpine

# bash and sed are needed by start-swarm.sh
RUN apk add --no-cache bash

WORKDIR /app

COPY package*.json ./

# Install all deps including devDependencies (tsx is required at runtime)
RUN npm install

COPY . .

# FOXMQ_URL, STELLAR_PUBLIC_KEY, STELLAR_SECRET_KEY, STELLAR_NETWORK
# must be set as Railway environment variables

CMD ["bash", "swarm/start-swarm.sh"]
