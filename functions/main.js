const legacy = require('./index');
const multiShop = require('./multishop-admin');

module.exports = {
  ...legacy,
  ...multiShop
};
