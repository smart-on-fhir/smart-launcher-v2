# Smart App Launch Proxy (fork of SMART Launcher)

## Fork Overview
This fork of the SMART Launcher has been slightly modified to be used as a proxy that enables SMART App Launch on top of a vanilla FHIR server.

It was used to support the launching of [Smart Forms](https://github.com/aehrc/smart-forms), a FHIR questionnaire rendering SMART app from a [EHR simulator](https://github.com/aehrc/smart-ehr-launcher) for demo and testing purposes.
Leveraging the existing internals of the SMART Launcher provides a way to indirectly enable the SMART App Launch functionality on top of any FHIR server, notably [HAPI](https://github.com/hapifhir/hapi-fhir-jpaserver-starter) in Smart Form's use case.

A live demo app is available at: https://ehr.smartforms.io

### Fork changes
- Removed the frontend portion of the launcher, moving it to the [Smart EHR Launcher project](https://github.com/aehrc/smart-ehr-launcher)
- Enabled support for the [fhirContext](https://build.fhir.org/ig/HL7/smart-app-launch/scopes-and-launch-context.html#fhircontext-exp) launch context, mainly to facilitate a questionnaire launch context for Smart Forms.
- Bug fixes for POSTing JSON payloads to the source FHIR server

If you don't need the above changes, you can use the original SMART Launcher project as is here: https://github.com/smart-on-fhir/smart-launcher-v2.

### Environment Configuration + Docker deployment
The fork made zero changes to the environment configuration, but it would be worth highlighting that at least one of `FHIR_SERVER_R2`, `FHIR_SERVER_R3` or `FHIR_SERVER_R4` must be set in the `.env` file.
Otherwise, all servers will default to SMART Health IT's servers.

#### Example docker usages:

Proxy sitting on top of https://proxy.smartforms.io/fhir, a HAPI FHIR R4 server:
```sh
docker run -p 8080:80 -e FHIR_SERVER_R4=https://proxy.smartforms.io/fhir aehrc/smart-launcher-v2:latest
```

Proxy without any configuration, defaulting to SMART Health IT's servers:
```sh
docker run -p 8080:80 aehrc/smart-launcher-v2:latest
```

You would be able to use the docker image from the original SMART Launcher project without any issues (and retain the original frontend as a bonus):
```sh
docker run -p 8080:80 -e FHIR_SERVER_R4=https://proxy.smartforms.io/fhir smartonfhir/smart-launcher-2:latest
```

```sh
docker run -p 8080:80 smartonfhir/smart-launcher-2:latest
```

### The frontend bit

The SMART Launcher project comes with a frontend to configure and launch SMART apps. 

This fork removes the frontend and moves it to the Smart EHR Launcher project (https://github.com/aehrc/smart-ehr-launcher), which acts as a minimal EHR to display a Patient summary and it's associated resources while retaining its app-launching capabilities.

The SMART EHR Launcher is a single-page application (SPA) built with React and [Vite](https://vitejs.dev/).
If you are planning to use the SMART EHR Launcher as the frontend, you will need to make an additional SPA deployment and configure it to point to the proxy server. See [here](https://github.com/aehrc/SMART-EHR-Launcher/blob/main/README.md) for more details.

<br/>

See below for the original README content from the SMART Launcher project.

---
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
docker build -t smartonfhir/smart-launcher-2:latest .
docker push smartonfhir/smart-launcher-2:latest
-->
