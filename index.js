const { NodeVM } = require('vm2');
const fs = require('fs');
const { Keypair } = require('stellar-sdk');

const IPFS_HOST = 'https://ipfs.infura.io:5001';
const IPFS_AUTH = 

(async () => {
  try {
    const HORIZON_URL = 'https://horizon-testnet.stellar.org'
    const STELLAR_NETWORK = 'TESTNET'

    const vm = new NodeVM({
      // console: 'off',
      eval: false,
      wasm: false,
      strict: true,
      sandbox: {
        HORIZON_URL,
        STELLAR_NETWORK,
      },
      require: {
        builtin: ['util', 'stream'],
        external: {
          modules: ['bignumber.js', 'node-fetch', 'stellar-sdk', 'lodash']
        },
        context: 'host',
      }
    })

    const seed = Keypair.random().publicKey();

    const txFunctionCode = fs.readFileSync('./dist/txF-RandomPixels.js', 'utf8')

    // const result = await runIssueTicket(vm, txFunctionCode)
    const result = await runGenerateNFT(vm, txFunctionCode)

    console.log("XDR:\n", result)
  }

  catch(err) {
    console.error(err)
  }
})()

async function runIssueTicket(vm, txFunctionCode){
    return await vm.run(txFunctionCode, 'vm.js')({
        stage: 'issueTicket',
        source: 'GCJ5K37ERWQK4HYBWNCRFT2HJVSMLVHHJVAISEW6CPFJ5RWCEZN44KJE',
        width: 10,
        height: 1,
        pixelPrice: 1,
        timestamp: Date.now()
    })
};

async function runGenerateNFT(vm, txFunctionCode){
    const seed = Keypair.random().publicKey();

    return await vm.run(txFunctionCode, 'vm.js')({
        stage: 'generateNFT',
        source: 'GCJ5K37ERWQK4HYBWNCRFT2HJVSMLVHHJVAISEW6CPFJ5RWCEZN44KJE',
        hostIpfs: IPFS_HOST,
        authIpfs: IPFS_AUTH,
        seed: seed
    })
};
