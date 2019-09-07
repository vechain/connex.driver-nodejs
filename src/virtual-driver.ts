import { JSONRPC } from '@vechain/json-rpc'
import * as WebSocket from 'isomorphic-ws'

function openWebSocket(url: string) {
    return new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(url)
        ws.onopen = () => {
            offWebSocket(ws)
            resolve(ws)
        }
        ws.onclose = ev => {
            offWebSocket(ws)
            reject(new Error(`websocket closed: ${ev.reason} (${ev.code})`))
        }
        ws.onerror = ev => {
            offWebSocket(ws)
            reject(ev.error)
            ws.close()
        }
    })
}

function offWebSocket(ws: WebSocket) {
    ws.onclose = null as any
    ws.onerror = null as any
    ws.onmessage = null as any
    ws.onopen = null as any
}

async function _connect(url: string) {
    let ws = await openWebSocket(url)
    let success = false

    const rpc = new JSONRPC((data, isRequest) => {
        if (!isRequest) {
            data = ' ' + data
        }
        ws.send(data)
        return Promise.resolve()
    })

    const setup = () => {
        rpc.setError(null)
        ws.onmessage = ev => {
            const isRequest = (ev.data as string)[0] !== ' '
            rpc.receive(ev.data as string, isRequest)
                .catch(err => {
                    // tslint:disable-next-line: no-console
                    console.warn('receive jsonrpc payload: ', err)
                })
        }
        ws.onclose = () => {
            offWebSocket(ws)
            rpc.setError(new Error('closed'))
            if (success) {
                reconnect()
            }
        }
        ws.onerror = ev => {
            offWebSocket(ws)
            rpc.setError(ev.error)
            if (success) {
                reconnect()
            }
            ws.close()
        }
    }

    const reconnect = () => {
        setTimeout(() => {
            openWebSocket(url)
                .then(c => {
                    ws = c
                    setup()
                })
                .catch(err => {
                    // tslint:disable-next-line: no-console
                    console.warn(err)
                    reconnect()
                })

        }, 10 * 1000)
    }

    setup()

    const info = await rpc.call('connect')
        .catch(err => {
            ws.close()
            return Promise.reject(err)
        })

    success = true
    return {
        rpc,
        genesis: info.genesis,
        initHead: info.head
    }
}

export async function connect(url: string): Promise<Connex.Driver> {
    const { rpc, genesis, initHead } = await _connect(url)
    let currentHead = initHead
    return {
        genesis,
        get head() { return currentHead },
        pollHead: async () => {
            const newHead = await rpc.call('pollHead')
            currentHead = newHead
            return newHead
        },
        getBlock: rev => {
            return rpc.call('getBlock', rev)
        },
        getTransaction: id => {
            return rpc.call('getTransaction', id)
        },
        getReceipt: id => {
            return rpc.call('getReceipt', id)
        },
        getAccount: (addr, rev) => {
            return rpc.call('getAccount', addr, rev)
        },
        getCode: (addr, rev) => {
            return rpc.call('getCode', addr, rev)
        },
        getStorage: (addr, key, rev) => {
            return rpc.call('getStorage', addr, key, rev)
        },
        explain: (arg, rev, cacheTies) => {
            return rpc.call('explain', arg, rev, cacheTies)
        },
        filterEventLogs: arg => {
            return rpc.call('filterEventLogs', arg)
        },
        filterTransferLogs: arg => {
            return rpc.call('filterTransferLogs', arg)
        },
        signTx: (msg, opt) => {
            return rpc.call('signTx', msg, opt)
        },
        signCert: (msg, opt) => {
            return rpc.call('signCert', msg, opt)
        },
        isAddressOwned: addr => {
            return rpc.call('isAddressOwned', addr)
        }
    }
}
