# Connex Driver for NodeJS

It drives Connex Framework to work in NodeJS environment. Now you can use Connex in NodeJS backend project.

## Installation

```bash
# install driver along with framework
npm i @vechain/connex-framework @vechain/connex.driver-nodejs
```

## Usage

The [REPL playground](https://github.com/vechain/connex-repl) is a good start.


```typescript
import { Framework } from '@vechain/connex-framework'
import { DriverNodeJS } from '@vechain/connex.driver-nodejs'

(async () => {
    const driver = await DriverNodeJS.connect('http://localhost:8669/')
    const connex = new Framework(driver)
    // here get connex object ready to use

    const wallet = driver.wallet
    // add account by importing private key
    wallet.add('<private key>')
    // remove account by address
    wallet.remove('<address>')
    // list all accounts
    wallet.list

    // config tx parameters, e.g. expiration, gasPriceCoef, watcher
    const txConfig = driver.txConfig

})()
```
