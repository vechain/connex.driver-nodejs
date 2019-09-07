import * as WebSocket from 'ws'
import { JSONRPC } from '@vechain/json-rpc'
import * as Http from 'http'
import * as Https from 'https'

const methods: Array<keyof Connex.Driver> = [
    'pollHead',
    'getBlock',
    'getTransaction',
    'getReceipt',
    'getAccount',
    'getCode',
    'getStorage',
    'explain',
    'filterEventLogs',
    'filterTransferLogs',
    'signTx',
    'signCert',
    'isAddressOwned',
]

export class DriverHost {
    private readonly wss: WebSocket.Server
    constructor(
        server: Http.Server | Https.Server,
        acceptor: (ws: WebSocket, request: Http.IncomingMessage) => Promise<Connex.Driver>
    ) {
        this.wss = new WebSocket.Server({
            server,
            path: '/connex-driver-host'
        })

        this.wss.on('connection', async (ws, req) => {
            try {
                const driver = await acceptor(ws, req)
                this.handleConnection(ws, driver)
            } catch (err) {
                ws.close()
            }
        })
    }

    public close() {
        this.wss.close()
    }

    private handleConnection(ws: WebSocket, driver: Connex.Driver) {
        const rpc = new JSONRPC((data, isRequest) => {
            if (!isRequest) {
                data = ' ' + data
            }
            ws.send(data)
            return Promise.resolve()
        })

        ws.on('message', data => {
            const isRequest = (data as string)[0] !== ' '
            rpc.receive(data as string, isRequest).catch(err => {
                // tslint:disable-next-line: no-console
                console.warn('receive jsonrpc payload: ', err)
            })
        })

        rpc.serve(method => {
            if (method === 'connect') {
                return () => ({
                    genesis: driver.genesis,
                    head: driver.head
                })
            }
            if (methods.includes(method as any)) {
                return (args: any[]) => {
                    return (driver as any)[method](...args)
                }
            }
        })
    }
}
