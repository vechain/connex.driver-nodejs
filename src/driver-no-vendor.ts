import { Net } from './interfaces'
import { WebSocketReader } from './websocket-reader'
import * as NodeURL from 'url'
import { PromInt, InterruptedError } from './promint'

/** class implements Connex.Driver leaves out Vendor related methods */
export abstract class DriverNoVendor implements Connex.Driver {
    public head: Connex.Thor.Status['head']

    private headResolvers = [] as Array<() => void>
    private int = new PromInt()

    constructor(
        private readonly net: Net,
        readonly genesis: Connex.Thor.Block,
        initialHead?: Connex.Thor.Status['head']
    ) {
        if (initialHead) {
            this.head = initialHead
        } else {
            this.head = {
                id: genesis.id,
                number: genesis.number,
                timestamp: genesis.timestamp,
                parentID: genesis.parentID,
                txsFeatures: genesis.txsFeatures
            }
        }
        this.headTrackerLoop()
    }

    // close the driver to prevent mem leak
    public close() {
        this.int.interrupt()
    }

    // implementations
    public pollHead() {
        return this.int.wrap(
            new Promise<Connex.Thor.Status['head']>(resolve => {
                this.headResolvers.push(() => resolve(this.head))
            }))
    }

    public getBlock(revision: string | number) {
        return this.httpGet(`blocks/${revision}`)
    }
    public getTransaction(id: string, head: string) {
        return this.httpGet(`transactions/${id}`, { head })
    }
    public getReceipt(id: string, head: string) {
        return this.httpGet(`transactions/${id}/receipt`, { head })
    }
    public getAccount(addr: string, revision: string) {
        return this.httpGet(`accounts/${addr}`, { revision })
    }
    public getCode(addr: string, revision: string) {
        return this.httpGet(`accounts/${addr}/code`, { revision })
    }
    public getStorage(addr: string, key: string, revision: string) {
        return this.httpGet(`accounts/${addr}/storage/${key}`, { revision })
    }
    public explain(arg: object, revision: string, cacheTies?: string[]) {
        return this.httpPost('accounts/*', arg, { revision })
    }
    public filterEventLogs(arg: object) {
        return this.httpPost('logs/event', arg)
    }
    public filterTransferLogs(arg: object) {
        return this.httpPost('logs/transfer', arg)
    }
    public abstract buildTx(
        msg: Array<{
            to: string | null;
            value: string;
            data: string;
            comment?: string;
            abi?: object;
        }>,
        options: {
            signer?: string;
            gas?: number;
            dependsOn?: string;
            link?: string;
            comment?: string;
        }
    ): Promise<{
        origin: string;
        raw: string;
        sign(delegation?: { signature?: string; error?: Error; }): Promise<Connex.Vendor.TxResponse>;
    }>
    public abstract signCert(
        msg: Connex.Vendor.CertMessage,
        options: { signer?: string; link?: string; }
    ): Promise<Connex.Vendor.CertResponse>
    public abstract isAddressOwned(addr: string): boolean
    //////
    protected httpGet(path: string, query?: object) {
        return this.net.http('GET', path, {
            query,
            headers: { 'x-genesis-id': this.genesis.id }
        })
    }

    protected httpPost(path: string, body: any, query?: object) {
        return this.net.http('POST', path, {
            query,
            headers: { 'x-genesis-id': this.genesis.id },
            body
        })
    }

    private emitNewHead() {
        const resolvers = this.headResolvers
        this.headResolvers = []
        resolvers.forEach(r => r())
    }

    private async headTrackerLoop() {
        let wsr: WebSocketReader | null = null
        let counter = 0
        for (; ;) {
            if (wsr) {
                try {
                    const beat: Beat = await this.int.wrap(wsr.read())
                    if (!beat.obsolete && beat.id !== this.head.id && beat.number >= this.head.number) {
                        this.head = {
                            id: beat.id,
                            number: beat.number,
                            timestamp: beat.timestamp,
                            parentID: beat.parentID,
                            txsFeatures: beat.txsFeatures
                        }
                        this.emitNewHead()
                    }
                } catch (err) {
                    // tslint:disable-next-line: no-console
                    console.warn('headTracker(ws):', err)
                    wsr.close()
                    wsr = null
                    if (err instanceof InterruptedError) {
                        break
                    }
                }
            } else {
                // fallback to http
                try {
                    const best: Connex.Thor.Block = await this.int.wrap(this.httpGet('blocks/best'))
                    if (best.id !== this.head.id && best.number >= this.head.number) {
                        this.head = {
                            id: best.id,
                            number: best.number,
                            timestamp: best.timestamp,
                            parentID: best.parentID,
                            txsFeatures: best.txsFeatures
                        }
                        this.emitNewHead()
                    }

                    if (Date.now() - this.head.timestamp * 1000 < 60 * 1000) {
                        // nearly synced
                        counter++
                        if (counter > 3) {
                            counter = 0
                            const wsURL = NodeURL.resolve(this.net.baseURL,
                                `subscriptions/beat?x-genesis-id=${this.genesis.id}&pos=${this.head.parentID}`)
                                .replace(/^https:/i, 'wss:')
                                .replace(/^http:/i, 'ws:')

                            wsr = new WebSocketReader(wsURL)
                            continue
                        }
                    }
                } catch (err) {
                    // tslint:disable-next-line: no-console
                    console.warn('headTracker(http):', err)
                    if (err instanceof InterruptedError) {
                        break
                    }
                }
                try {
                    await this.int.wrap(sleep(10 * 1000))
                } catch {
                    break
                }
            }
        }
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

interface Beat {
    number: number
    id: string
    parentID: string
    timestamp: number
    txsFeatures?: number
    obsolete: boolean
}
