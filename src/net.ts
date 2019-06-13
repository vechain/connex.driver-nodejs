import Axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import compareVersions from 'compare-versions'

export class Net {
    private axios: AxiosInstance

    constructor(baseUrl: string, headers?: object) {
        this.axios = Axios.create({
            baseURL: baseUrl,
            timeout: 15 * 1000,
            responseType: 'json',
            headers
        })
    }

    public httpGet(uri: string, query?: object) {
        return this.handleHttpResponse(() => this.axios.get(uri, { params: query }))
    }

    public httpPost(uri: string, data: any, query?: object) {
        return this.handleHttpResponse(() => this.axios.post(uri, data, { params: query }))
    }

    private async handleHttpResponse(f: () => Promise<AxiosResponse>) {
        let resp: AxiosResponse
        try {
            resp = await f()
        } catch (err) {
            throw new NetError(err)
        }
        const ver = resp.headers['x-thorest-ver'] || '0.0.0'
        if (compareVersions(ver, '1.1.0') < 0) {
            throw new Error(`${resp.config.method} ${resp.config.url}: thor node version too low`)
        }
        return resp.data
    }
}

class NetError extends Error {
    constructor(err: AxiosError) {
        if (err.response) {
            const resp = err.response

            if (typeof resp.data === 'string') {
                let text = resp.data.trim()
                if (text.length > 50) {
                    text = text.slice(0, 50) + '...'
                }
                super(`${resp.status} ${err.config.method} ${err.config.url}: ${text}`)
            } else {
                super(`${resp.status} ${err.config.method} ${err.config.url}`)
            }
        } else {
            super(`${err.config.method} ${err.config.url}: ${err.message}`)
        }
        this.name = NetError.name
    }
}
