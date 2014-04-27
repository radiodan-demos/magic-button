# Setting up Radiodan

## Prerequisites

- Node.js (v0.10+)
- mpd
- rabbitmq

## Installing

1. Clone the radiodan server and magic button applications:

    $ git clone https://github.com/radiodan/radiodan.js
    $ git clone https://github.com/radiodan/magic-button

2. Run `npm install` in both directories.
3. Download the announcer voices into the magic-button/audio directory:

    $ curl -L https://github.com/radiodan/magic-button/releases/download/untagged-3ee6adc061122d6c7ac5/serena.tar.gz | tar xz -C ./audio/

**(This doesn't work because the files haven't been released)**

4. Copy the example config files:

    $ cd magic-button
    $ cp config/radiodan-config.json.example config/radiodan-config.json

5. In `config/radiodan-config.json`, edit the `"defaults" -> "music"` key  to point to a writable directory where you will store your music.

    "defaults": {
      "music": "/Users/dan/Music"
    }

## Starting the app

Start rabbitmq:

    $ rabbitmq-server -detach

Radiodan server:

    $ cd radiodan.js
    $ ./bin/server ../magic-button/config/radiodan-config.json

In another terminal, start the magic button:

    $ cd magic-button
    $ BBC_SERVICES_URL=<url> ./bin/server ../magic-button/config/radiodan-config.json

You should be able to see the magic button web interface running on port 5000 at [http://localhost:5000]().

## Stopping 

Use Ctl-C to kill these processes. 

The magic button must be quit first otherwise it will hang waiting for the radiodan server to reply to its messages.

