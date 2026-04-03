FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y curl unzip ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /foxmq

RUN curl -L -o foxmq.zip https://github.com/tashigit/foxmq/releases/download/v0.3.1/foxmq_0.3.1_linux-amd64.zip \
    && unzip foxmq.zip \
    && rm foxmq.zip \
    && chmod +x foxmq

# Empty .env so foxmq doesn't pick up any env file
RUN touch .env

# Initialise single-node address book
RUN ./foxmq address-book from-range 0.0.0.0 19793 19793

EXPOSE 1883 8080

CMD ["./foxmq", "run", \
     "--mqtt-addr", "0.0.0.0:1883", \
     "--websockets", \
     "--websockets-addr", "0.0.0.0:8080", \
     "--cluster-addr", "0.0.0.0:19793", \
     "--secret-key-file", "foxmq.d/key_0.pem", \
     "--allow-anonymous-login"]
