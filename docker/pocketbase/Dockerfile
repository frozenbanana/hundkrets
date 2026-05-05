# PocketBase with migrations - based on https://pocketbase.io/docs/going-to-production/
FROM alpine:3.19

ARG PB_VERSION=0.36.4

RUN apk add --no-cache \
    unzip \
    ca-certificates

# Download PocketBase
ADD https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip /tmp/pb.zip
RUN unzip /tmp/pb.zip -d /pb/ && rm /tmp/pb.zip

# Copy migrations (run automatically on startup)
COPY pb_migrations /pb/pb_migrations

# Copy hooks (emails, etc.)
COPY pb_hooks /pb/pb_hooks

WORKDIR /pb

EXPOSE 8090

CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090", "--trustedHeaders=X-Forwarded-For,X-Real-IP"]
