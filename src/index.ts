import '@vechain/connex-framework'
import { Net } from './net'
import { newWallet } from './wallet'
import { Certificate, Transaction, cry } from 'thor-devkit'
import { randomBytes } from 'crypto'

export interface TxOptions {
    expiration?: number
    gasPriceCoef?: number

    watcher?: (txObj: { id: string, raw: string, resend: () => Promise<void> }) => void
}

export class DriverNodeJS implements Connex.Driver {
    public static async connect(baseUrl: string) {
        const net = new Net(baseUrl)
        const genesis = await net.httpGet('/blocks/0')
        return new DriverNodeJS(baseUrl, genesis)
    }

    public readonly genesis: Connex.Thor.Block
    public readonly head: Connex.Thor.Status['head']
    public readonly wallet = newWallet()
    public readonly txOptions: TxOptions = {}

    private readonly net: Net

    constructor(baseUrl: string, genesis: Connex.Thor.Block) {
        this.genesis = genesis
        this.net = new Net(baseUrl, { 'x-genesis-id': genesis.id })
        this.head = {
            id: genesis.id,
            number: genesis.number,
            timestamp: genesis.timestamp,
            parentID: genesis.parentID,
        }
        this.pollLoop()
    }

    public getBlock(revision: string | number) {
        return this.net.httpGet(`/blocks/${revision}`)
    }

    public getTransaction(id: string, head: string) {
        return this.net.httpGet(`/transactions/${id}`, { head })
    }

    public getReceipt(id: string, head: string) {
        return this.net.httpGet(`/transactions/${id}/receipt`, { head })
    }
    public getAccount(addr: string, revision: string) {
        return this.net.httpGet(`/accounts/${addr}`, { revision })
    }
    public getCode(addr: string, revision: string) {
        return this.net.httpGet(`/accounts/${addr}/code`, { revision })
    }
    public getStorage(addr: string, key: string, revision: string) {
        return this.net.httpGet(`/accounts/${addr}/storage/${key}`, { revision })
    }
    public explain(
        arg: { clauses: any[]; caller?: string | undefined; gas?: number | undefined; gasPrice?: string | undefined; },
        revision: string,
        cacheTies?: string[] | undefined
    ): Promise<any[]> {
        return this.net.httpPost('/accounts/*', arg, { revision })
    }

    public filterEventLogs(
        arg: { range: any; options: { offset: number; limit: number; }; criteriaSet: any[]; order: 'asc' | 'desc'; }) {
        return this.net.httpPost('/logs/event', arg)
    }
    public filterTransferLogs(
        arg: { range: any; options: { offset: number; limit: number; }; criteriaSet: any[]; order: 'asc' | 'desc'; }) {
        return this.net.httpPost('/logs/transfer', arg)
    }

    public async signTx(
        msg: Connex.Vendor.SigningService.TxMessage,
        options: {
            signer?: string | undefined;
            gas?: number | undefined;
            dependsOn?: string | undefined;
            link?: string | undefined;
            comment?: string | undefined;
            delegateHandler?: Connex.Vendor.SigningService.DelegationHandler
        }
    ): Promise<Connex.Vendor.SigningService.TxResponse> {
        const acc = options.signer ? this.wallet.list.find(a => a.address === options.signer) : this.wallet.list[0]
        if (!acc) {
            throw new Error('account missing')
        }

        const clauses = msg.map(c => ({ to: c.to, value: c.value, data: c.data }))
        const gas = options.gas ||
            (await this.estimateGas(clauses, acc.address))

        const tx = new Transaction({
            chainTag: Number.parseInt(this.genesis.id.slice(-2), 16),
            blockRef: this.head.id.slice(0, 18),
            expiration: this.txOptions.expiration || 18,
            clauses,
            gasPriceCoef: this.txOptions.gasPriceCoef || 0,
            gas,
            dependsOn: options.dependsOn || null,
            nonce: '0x' + randomBytes(8).toString('hex'),
            reserved: {
                features: options.delegateHandler ? 1 : 0
            }
        })
        if (options.delegateHandler) {
            const result = await options.delegateHandler({
                raw: '0x' + tx.encode().toString('hex'),
                origin: acc.address
            })
            const sig = acc.sign(tx.signingHash())
            tx.signature = Buffer.concat([sig, Buffer.from(result.signature.slice(2), 'hex')])
        } else {
            tx.signature = acc.sign(tx.signingHash())
        }

        const raw = '0x' + tx.encode().toString('hex')
        if (this.txOptions.watcher) {
            this.txOptions.watcher({
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
            signer: acc.address
        }
    }

    public async signCert(
        msg: Connex.Vendor.SigningService.CertMessage,
        options: { signer?: string | undefined; link?: string | undefined; }
    ) {
        const acc = options.signer ? this.wallet.list.find(a => a.address === options.signer) : this.wallet.list[0]
        if (!acc) {
            throw new Error('account missing')
        }

        const annex = {
            domain: 'localhost',
            timestamp: this.head.timestamp,
            signer: acc.address
        }
        const unsigned = Certificate.encode({
            ...msg,
            ...annex
        })
        const signature = '0x' + acc.sign(cry.blake2b256(unsigned)).toString('hex')
        return {
            annex,
            signature
        }
    }
    public isAddressOwned(addr: string) {
        return this.wallet.list.findIndex(a => a.address === addr) >= 0
    }

    private sendTx(raw: string) {
        return this.net.httpPost('/transactions', { raw })
    }

    private async pollLoop() {
        for (; ;) {
            try {
                const blockInterval = sleep(10 * 1000)
                const best = (await this.net.httpGet('/blocks/best')) as Connex.Thor.Block
                if (best.id !== this.head.id) {
                    this.head.id = best.id
                    this.head.number = best.number
                    this.head.timestamp = best.timestamp
                    this.head.parentID = best.parentID
                }
                await blockInterval
            } catch (err) {
                await sleep(15 * 1000)
            }
        }
    }
    private async estimateGas(clauses: Connex.Thor.Clause[], caller: string) {
        const outputs = await this.explain({
            clauses,
            caller,
        }, this.head.id)
        const execGas = outputs.reduce((sum, out) => sum + out.gasUsed, 0)
        const intrinsicGas = Transaction.intrinsicGas(clauses)

        return intrinsicGas + (execGas ? (execGas + 15000) : 0)
    }
}

function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
}