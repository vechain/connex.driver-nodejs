import { cry } from 'thor-devkit'

export function newWallet() {
    let list = [] as Array<{ address: string, privateKey: Buffer }>
    return {
        add(privateKey: string) {
            if (privateKey.startsWith('0x')) {
                privateKey = privateKey.slice(2)
            }
            if (!/^[0-9a-f]{64}$/i.test(privateKey)) {
                throw new Error('invalid private key')
            }
            const buf = Buffer.from(privateKey, 'hex')
            const addr = '0x' + cry.publicKeyToAddress(cry.secp256k1.derivePublicKey(buf)).toString('hex')
            list.push({ address: addr, privateKey: buf })
            return addr
        },
        remove(addr: string) {
            const oldList = list
            list = list.filter(i => i.address !== addr.toLowerCase())
            return oldList.length !== list.length
        },
        get list() {
            return list.map(i => {
                return {
                    address: i.address,
                    sign(msgHash: Buffer) {
                        return cry.secp256k1.sign(msgHash, i.privateKey)
                    }
                }
            })
        }
    }
}
