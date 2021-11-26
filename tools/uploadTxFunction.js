const fs = require('fs')
const { Keypair, TransactionBuilder, Server, Account, Networks, Operation, Asset } = require('stellar-sdk');
const fetch = require('node-fetch');
const BigNumber = require('bignumber.js');
const FormData = require('form-data');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

const txFunctionFilePath = "../dist/txF-RandomPixels.js";
const txFunctionFile = fs.readFileSync(txFunctionFilePath, 'utf8');
const txFunctionSize = fs.statSync(txFunctionFilePath).size;

const inputFields = JSON.parse(fs.readFileSync('inputFields.json'));
const inputFieldsBase64 = Buffer.from(JSON.stringify(inputFields)).toString('base64');

const feeAccountKeypair = Keypair.fromSecret('SCSTJAXINEIEBPXJQATERMWNBDY7G6MUANGJHV33I5666TJ4Z4FJAP3C');
const server = new Server(HORIZON_URL);

const turrets = [
    //"https://stellar-turrets-testnet.matusv.workers.dev",
    //"https://stellar-turrets-testnet.sdf-ecosystem.workers.dev",
    //"https://stellar-turrets-testnet.script3.workers.dev"
    "https://stellar-turrets-testnet.turretsdao.workers.dev"
]

console.log("txFunctionSize:", txFunctionSize);
//console.log("inputFieldsBase64:", inputFieldsBase64)

(async () => {
    for (let i = 0; i < turrets.length; i++){
        const turretDetails = await getTurretDetails(turrets[i])
        const turretPublicKey = turretDetails.turret;
        //const price = txFunctionSize / parseInt(turretDetails.divisor.upload)
        //console.log(`turrets[i].url, price: ${price}XLM`)

        const costResp = await uploadTxFunction(turrets[i], "")
        console.log(turrets[i], " ,cost:", costResp.cost)

        const feeTxXdr = await getTxFunctionUploadFeeTxXdr(
            feeAccountKeypair.publicKey(),
            turretPublicKey,
            costResp.cost
        )

        const resp = await uploadTxFunction(turrets[i], feeTxXdr)
        console.log(resp)
    }
})();

async function getTurretDetails(requestUrl) {
    var requestOptions = {
        method: 'GET',
        redirect: 'follow'
    };

    const resp = await fetch(requestUrl, requestOptions);
    return await resp.json()
}

async function getFee() {
  return server
  .feeStats()
  .then((feeStats) => feeStats?.fee_charged?.max || 100000)
  .catch(() => 100000)
};

async function getTxFunctionUploadFeeTxXdr(source, turretPK, price) {
    try {
        const feeAccount = await server.loadAccount(source);
        const fee = await getFee();
        let tx = new TransactionBuilder(feeAccount, {fee, networkPassphrase: Networks[STELLAR_NETWORK]});

        tx.addOperation(Operation.payment({
            source: source,
            destination: turretPK,
            asset: Asset.native(),
            amount: new BigNumber(price).toFixed(7)
        }));

        tx = tx.setTimeout(0).build();
        tx.sign(feeAccountKeypair);
        return tx.toXDR();
    } catch (e) {
        console.error(e);
    }
}

async function uploadTxFunction(url, feeTxXdr) {
    var formdata = new FormData();
    formdata.append("txFunction", txFunctionFile, "txF-RandomPixels.js");
    formdata.append("txFunctionFields", inputFieldsBase64);
    formdata.append("txFunctionFee", feeTxXdr);

    var requestOptions = {
      method: 'POST',
      body: formdata,
      redirect: 'follow'
    };

    const resp = await fetch(url + "/tx-functions", requestOptions);
    return await resp.json();
}
