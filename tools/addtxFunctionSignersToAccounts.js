const { Transaction, Server, Networks, Keypair, BASE_FEE, TransactionBuilder, Operation } = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

const feeKeypair = Keypair.fromSecret("SCSTJAXINEIEBPXJQATERMWNBDY7G6MUANGJHV33I5666TJ4Z4FJAP3C");
const ticketsKeypair = Keypair.fromSecret("SCVM4LF7MR74VXYJPN3GARCFP5TDR4I6JVRQW6H5JS7TLUBSTHMN7PVJ");
const issuerKeypair = Keypair.fromSecret("SDF2FCVCY4OVY42ZJRT7TWGZUZ2OIZTEW6A6BD2NAIREWELOATI6HZHQ");

const keypairs = [ticketsKeypair, issuerKeypair];
const signers = [
    "GCH2YSQL6ADAV7XMXCTHV2AYXLAZYAXGGBEL62GFCCPZ4NTSAVVL4AKA",
    "GC2J34SRPERHOQ63XN2ZSDTL6I2LUM536BIHCYTQI64F2R2S2C33DADW" //TurretsDAO
    //"GBFKHSGRBV44TS7KF3CZAPUFYJ26MXMMYISTRR4MDNGT2BFEWG6BMO6U",
    //"GDO4MNGPNSJB2ICHT722BQOEG36USRCHJM7N4CZLAHLKAEMEIP2GNEB3"
];

const server = new Server(HORIZON_URL);

(async function(){

    const account = await server.loadAccount(feeKeypair.publicKey());

    let transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    for (const keypair of keypairs) {
        for (const signer of signers) {

            transaction.addOperation(Operation.beginSponsoringFutureReserves({
                source: feeKeypair.publicKey(),
                sponsoredId: keypair.publicKey()
            }));

            transaction.addOperation(Operation.setOptions({
                source: keypair.publicKey(),
                signer: {
                    ed25519PublicKey: signer,
                    weight: 1
                },
                lowThreshold: signers.length,
                medThreshold: signers.length,
                highThreshold: signers.length,
                masterWeight: signers.length
            }));

            transaction.addOperation(Operation.endSponsoringFutureReserves({
                source: keypair.publicKey()
            }));
        }
    }

    transaction = transaction.setTimeout(0).build();

    transaction.sign(feeKeypair)

    for (const keypair of keypairs) {
        transaction.sign(keypair);
    }

    try {
      const txResult = await server.submitTransaction(transaction);
      //console.log(JSON.stringify(txResult, null, 2));
      console.log('Success! View the transaction at: ');
      console.log(txResult._links.transaction.href);
    } catch (e) {
      console.log('An error has occured:');
      console.log(e.response.data);
      console.log(e.response.data.extras.result_codes);
    }

})();
