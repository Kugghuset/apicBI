# Apps of ApicBI

## Overview

There are three apps in ApicBI, which all serve diferrent purpuses:

- Base app

- ICWS app

- Middlehand app

### Base app

Polls the ICWS SQL Server instance every 5 seconds and, when there is new data, pushes said data to Power BI. This app must be on a computer running the VPN to be able to access the server.

To start the app:

```bash
node server.js

# Using pm2
pm2 start server.js --name=ApicBI_Base
```

### ICWS app

Consumes the ICWS realtime API, manages state of for agents and interactions and poshes data to the RethinkDB instance. This app must be on a computer running the VPN to be able to access the ICWS realtime API. Can (and does) run on the same server as the _Base app_.

To start the app:

```bash
node index.js

# Using pm2
pm2 start index.js --name=ApicBI_ICWS
```

### Middlehand app

Pseudo frontend server which subscribes to changes in the RethinkDB instance and pushes changes out via Pusher. This app also serves tiny frontend modules which are embeddable by Power BI. This means it also must have SSL and be accessible from the web.

To start the app:

```bash
node middlehand/server.js

# Using pm2
pm2 start middlehand/server.js --name=ApicBI_Middlehand
```
