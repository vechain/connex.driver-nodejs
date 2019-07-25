import { Net } from './interfaces'
import Axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'

/** class simply implements Net interface */
export class SimpleNet implements Net {
    private readonly axios: AxiosInstance

    constructor(readonly baseURL: string, timeout = 15 * 1000) {
        this.axios = Axios.create({
            baseURL,
            timeout,
            responseType: 'json'
        })
    }

    public async http(
        method: 'GET' | 'POST',
        path: string,
        params?: { query?: object; body?: any; headers?: object; }): Promise<any> {
        params = params || {}
        try {
            const resp = await this.axios.request({
                method,
                url: path,
                data: params.body,
                headers: params.headers,
                params: params.query
            })
            return resp.data
        } catch (err) {
            throw convertError(err)
        }
    }
}

function convertError(err: AxiosError) {
    if (err.response) {
        const resp = err.response
        if (typeof resp.data === 'string') {
            let text = resp.data.trim()
            if (text.length > 50) {
                text = text.slice(0, 50) + '...'
            }
            return new Error(`${resp.status} ${err.config.method} ${err.config.url}: ${text}`)
        } else {
            return new Error(`${resp.status} ${err.config.method} ${err.config.url}`)
        }
    } else {
        return new Error(`${err.config.method} ${err.config.url}: ${err.message}`)
    }
}
