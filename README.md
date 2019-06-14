# Connex Driver for NodeJS

It drives Connex Framework to work in NodeJS environment. Now you can use Connex in NodeJS backend project.

## Installation

```bash
# install driver along with framework
npm i @vechain/connex-framework @vechain/connex.driver-nodejs
```

## Usage

```typescript
import { Framework } from '@vechain/connex-framework'
import { DriverNodeJS } from '@vechain/connex.driver-nodejs'

(async () => {
    const driver = await DriverNodeJS.connect('http://localhost:8669/')
    const connex = new Framework(driver)
    // here get connex object ready to use
})()
```
