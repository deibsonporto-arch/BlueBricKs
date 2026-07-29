FROM golang:1.25-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY *.go ./
RUN go mod tidy
RUN CGO_ENABLED=0 go build -o server .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
COPY --from=build /app/server /usr/local/bin/server
EXPOSE 8081
ENTRYPOINT ["server"]
