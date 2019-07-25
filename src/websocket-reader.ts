import * as WebSocket from 'isomorphic-ws'

export class WebSocketReader {
    private readonly ws: WebSocket
    private callbacks = [] as Array<{
        resolve(value: any): void
        reject(reason: Error): void
    }>
    private error?: Error
    constructor(url: string) {
        this.ws = new WebSocket(url)
        this.ws.onmessage = ev => {
            try {
                const value = JSON.parse(ev.data as string)
                const cbs = this.callbacks
                this.callbacks = []
                cbs.forEach(cb => cb.resolve(value))
            } catch (err) {
                this.setError(err)
                this.ws.close()
            }
        }
        this.ws.onerror = ev => {
            this.setError(ev.error)
            this.ws.close()
        }
        this.ws.onclose = () => {
            this.setError(new Error('closed'))
        }
    }

    public read() {
        return new Promise<any>((resolve, reject) => {
            if (this.error) {
                return reject(this.error)
            }

            this.callbacks.push({
                resolve,
                reject
            })
        })
    }

    public close() {
        this.ws.close()
    }

    private setError(err: Error) {
        if (!this.error) {
            this.error = err

            const cbs = this.callbacks
            this.callbacks = []
            cbs.forEach(cb => cb.reject(err))
        }
    }
}
