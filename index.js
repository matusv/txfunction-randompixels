const { NodeVM } = require('vm2');
const fs = require('fs');
const { Keypair, Networks, Transaction, Server } = require('stellar-sdk');

const IPFS_HOST = 'https://ipfs.infura.io:5001';
const IPFS_AUTH = '1zpUgZJjOIbCAtnjBHgHSeL6A6P:92760708c4d669eee886994f3c71d5cf';

const sourceKeypair = Keypair.fromSecret("SC6PWMNNK2CWFJRR4UYV4VCM4XZFGFDYKAOUV6JC227VE57A5VDUCZTE");
const issuerKeypair = Keypair.fromSecret("SCT4XB4PJ2TWMF7N3HVVLFWO7VMMZVNFQFHZJ6L6QK4IO56523GEMDER");
const ticketsKeypair = Keypair.fromSecret("SDLE45BGYB7U6SG23CUQDSXJDKESNDLIEAEO7TC4BDYSPU2X5FF4RP4M");


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

    const txFunctionCode = fs.readFileSync('./dist/txF-RandomPixels-testnet.js', 'utf8')

    let ticketTxHash = null;
    try {
        let issueTicketXdr = await runIssueTicket(vm, txFunctionCode)
        ticketTxHash = await submitXDR(issueTicketXdr);
    } catch (e) {
        console.log(e);
    }

    //ticketTxHash = "a0c25377f04134691a46809b34af2fe8af7edd980bdcb334a3cbc9db48344a75";

    console.log("");

    let generateNftXdr = await runGenerateNFT(vm, txFunctionCode, ticketTxHash)

    //console.log("XDR:\n", xdr)
    await submitXDR(generateNftXdr);
  }

  catch(err) {
    console.error(err)
  }
})()

async function runIssueTicket(vm, txFunctionCode){
    return await vm.run(txFunctionCode, 'vm.js')({
        stage: 'issueTicket',
        source: sourceKeypair.publicKey(),
        sizeIdx: 6,
        //numColors: 3,
        symmetryDepth: 3,
        clean: true,
        tip: 1,
        expectedPrice: 21
    })
};

async function runGenerateNFT(vm, txFunctionCode, ticketTxHash){
    const nftIssuerSeed = Keypair.random().publicKey();

    return await vm.run(txFunctionCode, 'vm.js')({
        stage: 'generateNFT',
        source: sourceKeypair.publicKey(),
        hostIpfs: IPFS_HOST,
        authIpfs: IPFS_AUTH,
        ticketTxHash: ticketTxHash,
        nftIssuerSeed: nftIssuerSeed
    })
};

async function submitXDR(xdr) {
    const server = new Server('https://horizon-testnet.stellar.org');
    let tx = new Transaction(xdr, Networks.TESTNET);
    tx.sign(sourceKeypair);
    tx.sign(issuerKeypair);
    tx.sign(ticketsKeypair);

    try {
        const txResult = await server.submitTransaction(tx);
        //console.log(JSON.stringify(txResult, null, 2));
        console.log('Success! View the transaction at: ');
        console.log(txResult._links.transaction.href);

        return txResult.hash;
    } catch (e) {
        console.log('An error has occured:');
        console.log(e.response.data);
        console.log(e.response.data.extras.result_codes);
    }
}
