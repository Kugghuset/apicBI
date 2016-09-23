# Getting started

## Installation and setup

For all apps, the following requirements are needed:

### Prerequisites

[Download Node.js (and npm) here](https://nodejs.org/en/)

[Download Git here](https://git-scm.com/downloads)

[Download RethinkDB here](https://www.rethinkdb.com/docs/install/)

All apps run on Node.js and are written using ES5, so versoin _v4.5.0 LTS_. When installing Node.js, npm (the package manager) is also downloaded, so no extra steps should be needed there.

Versioning and cloud storage of the code is done using Git, meaning it's highly recommended you have Git installed as well. (Obviously, simply downloading a Zip file is valid too, but that will make any contribution terribly hard).

The external database used for communicating between the ICWS Api consumer and middlehand app is RethinkDB. Follow instructions for your platform for proper installation. Make sure you can run it using the terminal. (For deployment, it should be run as a service, though)

### Cloning and

To clone the repo, simply navigate to the folder you want to be the parent of the project and use `git clone <repo web URL>`.

```bash
# Test npm out get checking its version
npm -v


# Test rethinkdb out by checking its version
rethinkdb -v

# Navigate into the folder
# Note: On windows, use C:\path\to\folder'
cd ~/path/to/folder

git clone https://github.com/Kugghuset/apicBI.git
```

When the repo is cloned, `cd` into it and run `npm install` to install all necessary dependencies for the project to run. Note: it may take some time to install all modules.

```bash
# Cd into the folder
cd apicBI

# Install dependencies
npm install
```


