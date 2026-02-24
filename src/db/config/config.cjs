module.exports = {
  development: {
    dialect: "sqlite",
    storage: ".tmp/hact-dev.sqlite",
    logging: false
  },
  test: {
    dialect: "sqlite",
    storage: ".tmp/hact-test.sqlite",
    logging: false
  }
};
