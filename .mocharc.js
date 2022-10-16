module.exports = {
    
    // Specify "require" for CommonJS
    require: "ts-node/register",

    // Specify "loader" for native ESM
    // loader: "ts-node/esm",

    extensions: ["ts"],

    // watch: true,

    "watch-files": [
        "backend",
        "test",
        "src/isomorphic"
    ],

    spec: [
        "./test/unit/**/*.test.ts",
        "./test/integration/**/*.test.ts"
    ],


    // ignore: ["tests/import.test.js"],
    // parallel: true,
    timeout: 5000, // defaults to 2000ms; increase if needed
    checkLeaks: true
}