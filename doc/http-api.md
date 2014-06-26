## Radiodan Restful API

This is probably the simplest way of controlling the radio, and the rest of the Magic 
Button App uses this API.

The commands are expressed in terms of [curl](http://curl.haxx.se), the command-line 
tool for transferring data with URL sntax.

The code itself is [here](https://github.com/radiodan/magic-button/blob/master/app/) and ends up installed in <code>/opt/radiodan/magic/app</code> 

### Radio

<code>radio/routes.js</code>

*Get all the available services*

Request:

    curl http://localhost/radio/services 

Response example:

    [
        {
             "id": "radio1",
             "title": "BBC Radio 1"
        },
        ...
    ]

*Change channel to a particular service*

List of channels: radio1 1xtra radio2 radio3 radio4 radio4-lw radio4extra 5live 
5livesportsextra 6music asiannetwork worldservice my-music

    curl -X POST http://localhost/radio/service/radio4 

Response:

    OK

*Change the volume to a particular value*

    curl -X POST http://localhost/radio/volume/value/50 

Response examples:

    {"volume":70}

    {"error":"Error: Volume diff must be integer"}

*Change the volume by an amount*

    curl -X POST http://localhost/radio/volume/diff/-10 

Response examples:

    {"volume":70} 
    {"error":"Error: Volume diff must be integer"}

*Find the volume*

    curl http://localhost/radio/volume 

Response example

    {"volume":70}

*Turn the radio off*

    curl -X DELETE http://localhost/radio/power

Response:

    OK

*Turn the radio on*

    curl -X POST http://localhost/radio/power

Response:

    OK

*Get the state of the radio*

    curl http://localhost/radio/power

Response examples:

    {"power":{"isOn":false}}

    {"power":{"isOn":true}}

*Cycle through channels*

    curl -X GET http://localhost/radio/next

Response:

    OK

*Get the state of the radio*

    curl http://localhost/radio/state.json

Result example:

    {
        "power": {
           "isOn": true
        },
        "current": {
            "id": "1xtra",
            "title": "BBC 1Xtra",
            "nowAndNext": [
               {
                   "episode": "24/06/2014",
                   "brand": "Charlie Sloth",
                   "id": "b0477jq0",
                   "start": "2014-06-24T15:00:00Z",
                   "end": "2014-06-24T16:45:00Z",
                   "duration": "PT1H45M",
                   "image": {
                       "id": "p01m1yyk",
                       "templateUrl": "http://ichef.bbci.co.uk/images/ic/$recipe/p01m1yyk.jpg"
                   }
                },
                {
                   "episode": "24/06/2014",
                   "brand": "Newsbeat",
                   "id": "b046ddpv",
                   "start": "2014-06-24T16:45:00Z",
                   "end": "2014-06-24T17:00:00Z",
                   "duration": "PT15M",
                   "image": {
                       "id": "p01lc3bc",
                       "templateUrl": "http://ichef.bbci.co.uk/images/ic/$recipe/p01lc3bc.jpg"
                   }
                }
            ],
            "nowPlaying": {
               "artist": "BANKS",
               "title": "Drowning",
               "contributions": [
                    {
                        "role": "performer/performer",
                        "name": "BANKS",
                        "position": 1,
                        "sort_name": "BANKS",
                        "image_pid": "p01mrzpf.jpg",
                        "mbid": "faa28a33-5470-4b90-90c3-e71955d93a44",
                        "type": "Person"
                    }
               ],
               "release_title": null,
               "isrc": null,
               "record_id": "n2g2mf",
               "label": null,
               "duration": 213,
               "programme": {
                    "episode_pid": "b0486nsy",
                    "brand_pid": "b00k3jr2",
                    "start": "Tue Jun 24 13:00:00 +0100 2014",
                    "episode_title": "Adele Roberts sits in for Sarah-Jane",
                    "end": "Tue Jun 24 16:00:00 +0100 2014",
                    "version_pid": "b0486ns1",
                    "brand_title": "Sarah-Jane Crawford"
               },
               "received": "2014-06-24T13:19:29.339Z"
            }
        },
        "audio": {
             "volume": 60
        },
        "avoider": {
             "isAvoiding": false
        },
        "services": [
            {
               "id": "radio1",
               "title": "BBC Radio 1"
            }
        ...
        ]
     }

### Announcer

<code>announcer/routes.js</code>

*Get the state of the announcer*

     curl http://localhost/announcer/state.json

Response examples:

     {"isAnnouncing":false}
     {"isAnnouncing":true}

*Announce*

     curl -X POST http://localhost/announcer

Response:

     OK

*Cancel announcing*

     curl -X DELETE http://localhost/announcer

Response:

     OK


### Avoider

<code>avoider/routes.js</code>

*Get the state of the avoider*

    curl -X GET http://localhost/avoider/state.json

Reponses:

     {"isAvoiding":false}

     {"isAvoiding":true}

*Avoid*

     curl -X POST http://localhost/avoider

Response:

     OK

*Cancel avoiding*

     curl -X DELETE http://localhost/avoider

Reponse:

     OK

