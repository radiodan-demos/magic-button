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
    $ BBC_SERVICES_URL=<url> node main.js config/radiodan-config.json

You should be able to see the magic button web interface running on port 5000 at [http://localhost:5000]().

## Stopping

Use Ctl-C to kill these processes.

The Magic Button app will attempt to stop any active players in the radio before
it shuts down. If this is not possible, it will exit with a non-zero code.

### Exit Code guide:

| Code | Description                                       |
| :--: | -----------                                       |
| 0    | Success                                           |
| 1    | Promises Failed (could not clear all the players) |
| 2    | Exited on Timeout                                 |

## Development

The front-end single-page web app is in `app/ui`. Templates are in `views`. `index.html` is the main page that pulls in a load of partials representing the different components on the page.

### Static assets

All static assets to be exposed to a browser must be in the `public` directory. See `Building` below for more information.

### Javascript

`static/js` contains all the javascript. [Browserify](http://browserify.org/) is used which enables the javascript to be written in a modular way and each module is included when necessary using `require`.

We try to adhere to the [AirBnB style guide](https://github.com/airbnb/javascript).

Any javascript files in `static/js` must be `required` into `app.js`  otherwise it will not be built.

### CSS

`static/css` contains a single LESS file `app.less` that includes all the individual CSS files inc `static/css/modules/`. No LESS features are used, we favour plain CSS but LESS supports the inclusion and compilation of multiple files into a single file.

`lib` contains any library CSS such as [Pure](http://purecss.io/). This CSS must be imported into `static/css/app.less`.

### Lib

`static/lib` contains any CSS or JS that will not be included via Browserify or LESS during the build step. It must be referenced in the application templates.

### Building

`grunt` is used to compile all the javascript into a single file `public/assets/js/app.js` for deployment and all the CSS into a single file `public/assets/css/app.css`.

Any other directories in `app/ui/static` will be copied unchanged to `public/assets`.

When changing the front-end code you must run `grunt build` otherwise you won't see the changes to your javascript or CSS.

You must commit the compiled JS/CSS in `public` when you commit your code changes.

