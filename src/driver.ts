
import { DriverNoVendor } from './driver-no-vendor'
import { Net, Wallet } from './interfaces'
import { Certificate, Transaction, cry } from 'thor-devkit'
import { randomBytes } from 'crypto'

/** class fully implements Connex.Driver */
export class Driver extends DriverNoVendor {
    /**
     * create driver instance
     * @param net
     * @param wallet
     */
    public static async connect(net: Net, wallet: Wallet) {
        const genesis: Connex.Thor.Block = await net.http('GET', 'blocks/0')
        const best: Connex.Thor.Block = await net.http('GET', 'blocks/best',
            { headers: { 'x-genesis-id': genesis.id } })

        return new Driver(
            net,
            genesis, {
                id: best.id,
                number: best.number,
                timestamp: best.timestamp,
                parentID: best.parentID,
                txsFeatures: best.txsFeatures
            },
            wallet)

    }

    /** handler to receive txs committed */
    public onTxCommit?: (txObj: TxObject) => void

    /** params for tx construction */
    public txParams = {
        expiration: 18,
        gasPriceCoef: 0
    }

    constructor(
        net: Net,
        genesis: Connex.Thor.Block,
        initialHead: Connex.Thor.Status['head'],
        private readonly wallet: Wallet
    ) {
        super(net, genesis, initialHead)
    }

    public async signTx(
        msg: Array<{
            to: string | null
            value: string
            data: string
            comment?: string
        }>,
        options: {
            signer?: string | undefined;
            gas?: number | undefined;
            dependsOn?: string | undefined;
            link?: string | undefined;
            comment?: string | undefined;
            delegateHandler?: Connex.Vendor.SigningService.DelegationHandler
        }
    ): Promise<Connex.Vendor.SigningService.TxResponse> {
        const key = this.findKey(options.signer)

        const clauses = msg.map(c => ({ to: c.to, value: c.value, data: c.data }))
        const gas = options.gas ||
            (await this.estimateGas(clauses, key.address))

        const tx = new Transaction({
            chainTag: Number.parseInt(this.genesis.id.slice(-2), 16),
            blockRef: this.head.id.slice(0, 18),
            expiration: this.txParams.expiration,
            clauses,
            gasPriceCoef: this.txParams.gasPriceCoef,
            gas,
            dependsOn: options.dependsOn || null,
            nonce: '0x' + randomBytes(8).toString('hex'),
            reserved: {
                features: options.delegateHandler ? 1 : 0
            }
        })

        const originSig = key.sign(tx.signingHash())
        if (options.delegateHandler) {
            const result = await options.delegateHandler({
                raw: '0x' + tx.encode().toString('hex'),
                origin: key.address
            })
            tx.signature = Buffer.concat([originSig, Buffer.from(result.signature.slice(2), 'hex')])
        } else {
            tx.signature = originSig
        }

        const raw = '0x' + tx.encode().toString('hex')
        if (this.onTxCommit) {
            this.onTxCommit({
                id: tx.id!,
                raw,
                resend: async () => {
                    await this.sendTx(raw)
                }
            })
        }
        await this.sendTx(raw)
        return {
            txid: tx.id!,
            signer: key.address
        }
    }

    public async signCert(
        msg: Connex.Vendor.SigningService.CertMessage,
        options: { signer?: string | undefined; link?: string | undefined; }
    ) {
        const key = this.findKey(options.signer)

        const annex = {
            domain: 'localhost',
            timestamp: this.head.timestamp,
            signer: key.address
        }
        const unsigned = Certificate.encode({
            ...msg,
            ...annex
        })
        const signature = '0x' + key.sign(cry.blake2b256(unsigned)).toString('hex')
        return {
            annex,
            signature
        }
    }
    public isAddressOwned(addr: string) {
        return this.wallet.list.findIndex(k => k.address === addr) >= 0
    }

    private findKey(addr?: string) {
        const keys = this.wallet.list
        const key = addr ? keys.find(k => k.address === addr) : keys[0]
        if (!key) {
            throw new Error('empty wallet')
        }
        return key
    }

    private sendTx(raw: string) {
        return this.httpPost('transactions', { raw })
    }

    private async estimateGas(
        clauses: Array<{
            to: string | null
            value: string
            data: string
        }>,
        caller: string) {
        const outputs: Connex.Thor.VMOutput[] = await this.explain({
            clauses,
            caller,
        }, this.head.id)
        const execGas = outputs.reduce((sum, out) => sum + out.gasUsed, 0)
        const intrinsicGas = Transaction.intrinsicGas(clauses)

        return intrinsicGas + (execGas ? (execGas + 15000) : 0)
    }
}

export interface TxObject {
    id: string
    raw: string
    resend(): Promise<void>
}
