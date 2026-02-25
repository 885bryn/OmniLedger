"use strict";

const { createApp } = require("./app");

function startServer(options = {}) {
  const app = options.app || createApp();
  const port = Number(options.port || process.env.PORT || 8080);
  const host = options.host || process.env.HOST || "0.0.0.0";

  const server = app.listen(port, host, () => {
    console.log(`API listening on ${host}:${port}`);
  });

  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer
};
