# SMART Launcher
This server acts as a proxy that intercepts requests to otherwise open FHIR
servers and requires those requests to be properly authorized. It also provides
a SMART implementation that is loose enough to allow for apps to launch against
this server without having to register clients first.

## Installation
Make sure you have `git` and `NodeJS` 16 or higher, and then run:
```sh
git clone https://github.com/smart-on-fhir/smart-launcher-v2
cd smart-launcher-v2
npm i
```

## Configuration
Although this server is designed to work without any configuration, one might
want to customize a few things. To do so, create a file named `.env` in the
root folder of the project. There is a file named `example.env` containing some
default settings which you can copy and rename to `.env`:
```sh
mv example.env .env
```
Then read the comments above each environment variable and decide what you would
like to change.

NOTE: The `.env` file is included in `.gitignore` and cannot be pushed with git.
If you want to deploy this to remote server, you will have to create another
`.env` file on the server, or set those environment variables in some other way.

## Usage
There are two major ways to start the launcher:

### Starting in production mode
Use when you want to run the launcher normally, either locally or deployed online.
1. Set `NODE_ENV = "production"` in your `.env` file (unless it is already set in your environment)
2. Set `PORT` in your `.env` file (unless it is already set in your environment)
3. Make sure `LAUNCHER_PORT` env variable is not set
4. Run `npm run build`
5. Run `npm start`

### Starting in development mode
Use when you want to modify the source code.
1. Set `NODE_ENV = "development"` in your `.env` file
2. Run `npm run start:server:watch` to start the backend
3. In another terminal run `npm start` to start the frontend
4. Optionally, in another terminal run `npm npm run test:server:watch` to test changes

## Testing
- To execute the backend tests run `test:server`
- To execute the backend tests continuously run `test:server:watch`
- To check the code coverage, after executing the tests open `coverage/lcov-report/index.html`

## Key generation
To generate new certificates for your ssl server:
1. Make sure you have `openssl` (comes pre-installed on Mac)
2. `cd` to the project root
3. Execute `npm run cert`
Then (re)start the server and it will use the new keys.

## Using Docker
The launcher is also available as a Docker image. To use that simply run
```
docker run -t -p 8080:80 smartonfhir/smart-launcher-2:latest
```
and open http://localhost:8080

<!--
docker build -t smartonfhir/smart-launcher:latest .
docker push smartonfhir/smart-launcher:latest
-->