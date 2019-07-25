
/** Net interface supports http transport */
export interface Net {
    /** base URL */
    readonly baseURL: string

    /**
     * perform http request
     * @param method 'GET' or 'POST'
     * @param path path to access
     * @param params additional params
     * @returns response body, JSON decoded
     */
    http(
        method: 'GET' | 'POST',
        path: string,
        params?: Net.Params
    ): Promise<any>
}

export namespace Net {
    /** http request params */
    export interface Params {
        query?: object
        body?: any // JSON encoded
        headers?: object
    }
}

/** Wallet interface manages private keys */
export interface Wallet {
    /** list all keys */
    readonly list: Wallet.Key[]
}

export namespace Wallet {
    /** describes an operational key */
    export interface Key {
        /** address derived from key */
        address: string
        /**
         * sign message hash
         * @param msgHash message hash
         * @returns signature
         */
        sign(msgHash: Buffer): Buffer
    }
}
