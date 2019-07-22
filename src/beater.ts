import '@vechain/connex-framework'
import * as WebSocket from 'isomorphic-ws'
import * as NodeUrl from 'url'

export interface Beat {
    number: number
    id: string
    parentID: string
    timestamp: number
    txsFeatures?: number
    obsolete: boolean
}

export const listen = (
    listener: (b: Beat) => void,
    baseUrl: string,
    genesis: Connex.Thor.Block,
    head: Connex.Thor.Status['head']
) => {
    // No need to subscribe beat now, subscribe to blocks
    const parsed = NodeUrl.parse(NodeUrl.resolve(baseUrl, `subscriptions/block?x-genesis-id=${genesis.id}`))
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = NodeUrl.format(parsed)

    const next = () => {
        const ws = new WebSocket(url + `&pos=${encodeURIComponent(head.parentID)}`)
        let idles = 0

        // ws timeout
        const timer = setInterval(() => {
            idles++
            if (idles > 5) {
                ws.close()
            }
        }, 10 * 1000)

        ws.onmessage = ev => {
            try {
                listener(JSON.parse(ev.data as string))
                idles = 0
            } catch (err) {
                ws.close()
            }
        }
        ws.onerror = () => {
            ws.close()
        }
        ws.onclose = () => {
            setTimeout(next, 20 * 1000)
            clearInterval(timer)
        }
    }

    next()
}
