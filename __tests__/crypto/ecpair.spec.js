import assert from 'assert'
import ecurve from 'ecurve'
import proxyquire from 'proxyquire'
import sinon from 'sinon'
import sinonTestFactory from 'sinon-test'
import BigInteger from 'bigi'

import ECPair from '@/crypto/ecpair'
import ecdsa from '@/crypto/ecdsa'
import configManager from '@/managers/config'

import fixtures from './fixtures/ecpair.json'
import { NETWORKS, NETWORKS_LIST } from '../utils/network-list'

const curve = ecdsa.__curve
const sinonTest = sinonTestFactory(sinon)

beforeEach(() => configManager.setConfig(NETWORKS.mainnet))

describe('ECPair', () => {
  describe('constructor', () => {
    it('defaults to compressed', () => {
      const keyPair = new ECPair(BigInteger.ONE)

      expect(keyPair.compressed).toBeTruthy()
    })

    it('supports the uncompressed option', () => {
      const keyPair = new ECPair(BigInteger.ONE, null, {
        compressed: false
      })

      expect(keyPair.compressed).toBeTruthy()
    })

    it('supports the network option', () => {
      const keyPair = new ECPair(BigInteger.ONE, null, {
        compressed: false,
        network: NETWORKS.testnet
      })

      expect(keyPair.network).toEqual(NETWORKS.testnet)
    })

    fixtures.valid.forEach((f) => {
      it('calculates the public point for ' + f.WIF, () => {
        const d = new BigInteger(f.d)
        const keyPair = new ECPair(d, null, {
          compressed: f.compressed
        })

        expect(keyPair.getPublicKeyBuffer().toString('hex')).toBe(f.Q)
      })
    })

    fixtures.invalid.constructor.forEach((f) => {
      it('throws ' + f.exception, () => {
        const d = f.d && new BigInteger(f.d) // eslint-disable-line no-new
        const Q = f.Q && ecurve.Point.decodeFrom(curve, Buffer.from(f.Q, 'hex'))

        assert.throws(() => {
          new ECPair(d, Q, f.options) // eslint-disable-line no-new
        }, new RegExp(f.exception))
      })
    })
  })

  describe('getPublicKeyBuffer', () => {
    let keyPair

    beforeEach(() => {
      keyPair = new ECPair(BigInteger.ONE)
    })

    it('wraps Q.getEncoded', sinonTest(function () {
      this
        .mock(keyPair.Q)
        .expects('getEncoded')
        .once()
        .withArgs(keyPair.compressed)

      keyPair.getPublicKeyBuffer()
    }))
  })

  describe('fromWIF', () => {
    fixtures.valid.forEach((f) => {
      it('imports ' + f.WIF + ' (' + f.network + ')', () => {
        const network = NETWORKS[f.network]
        const keyPair = ECPair.fromWIF(f.WIF, network)

        expect(keyPair.d.toString()).toBe(f.d)
        expect(keyPair.getPublicKeyBuffer().toString('hex')).toBe(f.Q)
        expect(keyPair.compressed).toBe(f.compressed)
        expect(keyPair.network).toEqual(network)
      })
    })

    fixtures.valid.forEach((f) => {
      it('imports ' + f.WIF + ' (via list of networks)', () => {
        const keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)

        expect(keyPair.d.toString()).toBe(f.d)
        expect(keyPair.getPublicKeyBuffer().toString('hex')).toBe(f.Q)
        expect(keyPair.compressed).toBe(f.compressed)
        expect(keyPair.network).toEqual(NETWORKS[f.network])
      })
    })

    fixtures.invalid.fromWIF.forEach((f) => {
      it('throws on ' + f.WIF, () => {
        assert.throws(() => {
          const networks = f.network ? NETWORKS[f.network] : NETWORKS_LIST

          ECPair.fromWIF(f.WIF, networks)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('toWIF', () => {
    fixtures.valid.forEach((f) => {
      it('exports ' + f.WIF, () => {
        const keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)

        expect(keyPair.toWIF()).toBe(f.WIF)
      })
    })
  })

  describe('makeRandom', () => {
    let d = Buffer.from('0404040404040404040404040404040404040404040404040404040404040404', 'hex')
    let exWIF = 'S9hzwiZ5ziKjUiFpuZX4Lri3rUocDxZSTy7YzKKHvx8TSjUrYQ27'

    it.skip('uses randombytes RNG to generate a ECPair', () => {
      const stub = {
        randombytes: () => {
          return d
        }
      }
      const ProxiedECPair = proxyquire('../../src/crypto/ecpair', stub).default

      const keyPair = ProxiedECPair.makeRandom()
      expect(keyPair.toWIF()).toBe(exWIF)
    })

    it('allows a custom RNG to be used', () => {
      const keyPair = ECPair.makeRandom({
        rng: (size) => {
            return d.slice(0, size)
        }
      })

      expect(keyPair.toWIF()).toBe(exWIF)
    })

    it('retains the same defaults as ECPair constructor', () => {
      const keyPair = ECPair.makeRandom()

      expect(keyPair.compressed, true)
      expect(keyPair.network).toEqual(NETWORKS.mainnet)
    })

    it('supports the options parameter', () => {
      const keyPair = ECPair.makeRandom({
        compressed: false,
        network: NETWORKS.testnet
      })

      expect(keyPair.compressed).toBeFalsy()
      expect(keyPair.network).toEqual(NETWORKS.testnet)
    })

    it('loops until d is within interval [1, n - 1] : 1', sinonTest(function () {
      const rng = this.mock()
      rng.exactly(2)
      rng.onCall(0).returns(BigInteger.ZERO.toBuffer(32)) // invalid length
      rng.onCall(1).returns(BigInteger.ONE.toBuffer(32)) // === 1

      ECPair.makeRandom({rng})
    }))

    it('loops until d is within interval [1, n - 1] : n - 1', sinonTest(function () {
      const rng = this.mock()
      rng.exactly(3)
      rng.onCall(0).returns(BigInteger.ZERO.toBuffer(32)) // < 1
      rng.onCall(1).returns(curve.n.toBuffer(32)) // > n-1
      rng.onCall(2).returns(curve.n.subtract(BigInteger.ONE).toBuffer(32)) // === n-1

      ECPair.makeRandom({rng})
    }))
  })

  describe('getAddress', () => {
    fixtures.valid.forEach((f) => {
      it('returns ' + f.address + ' for ' + f.WIF, () => {
        const keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)

        expect(keyPair.getAddress()).toBe(f.address)
      })
    })
  })

  describe('getNetwork', () => {
    fixtures.valid.forEach((f) => {
      it('returns ' + f.network + ' for ' + f.WIF, () => {
        const keyPair = ECPair.fromWIF(f.WIF, NETWORKS_LIST)

        expect(keyPair.getNetwork()).toEqual(NETWORKS[f.network])
      })
    })
  })

  describe('ecdsa wrappers', () => {
    let keyPair
    let hash

    beforeEach(() => {
      keyPair = ECPair.makeRandom()
      hash = Buffer.alloc(32)
    })

    describe('signing', () => {
      it('wraps ecdsa.sign', sinonTest(function () {
        this.mock(ecdsa).expects('sign')
          .once().withArgs(hash, keyPair.Q)

        keyPair.sign(hash)
      }))

      it('throws if no private key is found', () => {
        keyPair.Q = null

        assert.throws(() => {
          keyPair.sign(hash)
        }, /Missing private key/)
      })
    })

    describe('verify', () => {
      let signature

      beforeEach(() => {
        signature = keyPair.sign(hash)
      })

      it('wraps ecdsa.verify', sinonTest(function () {
        this
          .mock(ecdsa)
          .expects('verify')
          .once()
          .withArgs(hash, signature, keyPair.Q)

        keyPair.verify(hash, signature)
      }))
    })
  })
})
