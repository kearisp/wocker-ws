FROM golang:latest

ENV GO_RUN "go run main.go"

WORKDIR /usr/app

# -----
RUN apt-get update
RUN apt-get install -y \
      xvfb \
      libfontconfig \
      wkhtmltopdf
# -----

EXPOSE 80

CMD go mod download && \
#    go get github.com/loov/watchrun && \
    ${GO_RUN}