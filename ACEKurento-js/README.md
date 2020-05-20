# ACEKurento
ACEKurento.js is a shim that uses WebRTC, connects to the node.js ACEDirect backend and interacts with a Kurento Media Server to make/receive one to one calls to/from Asterisk

### To build a new ACEKurento.js version

Run:

- `npm run patch` Creates the .js .min.js and .map files for the patch version of your release
- `npm run minor` Creates the .js .min.js and .map files for the minor version of your release
- `npm run major` Creates the .js .min.js and .map files for the major version of your release

Then:

1. Create a new branch called to-v(your version) (e.g: to-v1.1.0) and commit/push your changes.
2. Go to github releases and name it properly.


### To Run locally:

1) npm install  
2) grunt build-version:major  
3) Use the dist minified version in your frontend app


### To Generate SDK documentation:

./node_modules/.bin/jsdoc dist/ACEKurento-1.0.0.js