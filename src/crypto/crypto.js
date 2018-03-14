const createHash = require('create-hash')

class Crypto {
  ripemd160 (buffer) {
    return createHash('rmd160').update(buffer).digest()
  }
  sha1 (buffer) {
    return createHash('sha1').update(buffer).digest()
  }
  sha256 (buffer) {
    return createHash('sha256').update(buffer).digest()
  }
  hash160 (buffer) {
    return this.ripemd160(this.sha256(buffer))
  }
  hash256 (buffer) {
    return this.sha256(this.sha256(buffer))
  }
}

export default new Crypto()
