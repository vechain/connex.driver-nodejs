import '@vechain/connex-framework'
import { Net } from './net'

export class DriverNodeJS implements Connex.Driver {
    public static async createAuto(baseUrl: string) {
        const net = new Net(baseUrl)
        const genesis = await net.httpGet('/blocks/0')
        return new DriverNodeJS(baseUrl, genesis)
    }

    public readonly genesis: Connex.Thor.Block
    public readonly head: Connex.Thor.Status['head']

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

    public signTx(
        msg: any,
        options: {
            delegated?: boolean | undefined;
            signer?: string | undefined; gas?: number | undefined;
            dependsOn?: string | undefined;
            link?: string | undefined;
            comment?: string | undefined;
        }
    ): Promise<{
        unsignedTx?: { raw: string; origin: string; } | undefined;
        doSign(delegatorSignature?: string | undefined): Promise<any>;
    }> {
        throw new Error('Method not implemented.')
    }
    public signCert(
        msg: any,
        options: { signer?: string | undefined; link?: string | undefined; }
    ): Promise<any> {
        throw new Error('Method not implemented.')
    }
    public isAddressOwned(addr: string) { return false }

    private async pollLoop() {
        for (; ;) {
            try {
                const startTime = Date.now()
                const best = (await this.net.httpGet('/blocks/best')) as Connex.Thor.Block
                this.head.id = best.id
                this.head.number = best.number
                this.head.timestamp = best.timestamp
                this.head.parentID = best.parentID

                const sleepTime = 10 * 1000 - (Date.now() - startTime)
                if (sleepTime > 0) {
                    await sleep(sleepTime)
                }
            } catch (err) {
                await sleep(5 * 1000)
            }
        }
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
