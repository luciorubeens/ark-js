import feeManager from '@/managers/fee'
import cryptoBuilder from '@/builder/crypto'
import slots from '@/crypto/slots'
import Transaction from '@/builder/transaction'
import Model from '@/models/transaction'
import { TRANSACTION_TYPES } from '@/constants'

export default class MultiPayment extends Transaction {
  constructor () {
    super()

    this.id = null
    this.type = TRANSACTION_TYPES.MULTI_PAYMENT
    this.fee = feeManager.get(TRANSACTION_TYPES.MULTI_PAYMENT)
    this.timestamp = slots.getTime()
    this.payments = {}
    this.vendorFieldHex = null
    this.version = 0x02
  }

  create () {
    return this
  }

  setVendorField (data, type) {
    this.vendorFieldHex = Buffer.from(data, type).toString('hex')
    return this
  }

  addPayment (address, amount) {
    const paymentsCount = Object.keys(this.payments).length / 2

    if (paymentsCount >= 2258) {
      throw new Error('A maximum of 2259 outputs is allowed')
    }

    const key = paymentsCount + 1
    this.payments[`address${key}`] = address
    this.payments[`amount${key}`] = amount
    return this
  }

  sign (passphrase) {
    const keys = crypto.getKeys(passphrase)
    this.senderPublicKey = keys.publicKey
    this.signature = crypto.sign(this, keys)
    return this
  }

  secondSign (transaction, passphrase) {
    const keys = crypto.getKeys(passphrase)
    this.secondSignature = crypto.secondSign(transaction, keys)
    return this
  }

  verify () {
    return crypto.verify(this)
  }

  serialise () {
    const struct = {
      hex: crypto.getBytes(this).toString('hex'),
      id: crypto.getId(this),
      signature: this.signature,
      secondSignature: this.secondSignature,
      timestamp: this.timestamp,

      type: this.type,
      fee: this.fee,
      senderPublicKey: this.senderPublicKey,
      vendorFieldHex: this.vendorFieldHex
    }

    return Model.serialise(Object.assign(struct, this.payments))
  }
}
