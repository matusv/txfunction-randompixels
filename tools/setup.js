const fs = require('fs');
const { Keypair, Networks, Transaction, Server, TransactionBuilder, Operation, BASE_FEE } = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

const creatorKeypair = Keypair.fromSecret("SCF4V6GFT2IK57S57YYYQHE4VO4O5N2N333Q57VTLILCT7U7VTLN7CWZ");
const issuerKeypair = Keypair.random();
const ticketsKeypair = Keypair.random();

//const ticketsKeypair = Keypair.fromSecret("SDLE45BGYB7U6SG23CUQDSXJDKESNDLIEAEO7TC4BDYSPU2X5FF4RP4M");
//const issuerKeypair = Keypair.fromSecret("SCT4XB4PJ2TWMF7N3HVVLFWO7VMMZVNFQFHZJ6L6QK4IO56523GEMDER");

console.log(`Issuer:\npublic: ${issuerKeypair.publicKey()}\nsecret: ${issuerKeypair.secret()}`);
console.log(`Tickets:\npublic: ${ticketsKeypair.publicKey()}\nsecret: ${ticketsKeypair.secret()}`);

const server = new Server(HORIZON_URL);

(async () => {
    const creatorAccount = await server.loadAccount(creatorKeypair.publicKey());

    let tx = new TransactionBuilder(creatorAccount, {
        fee: BASE_FEE,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    tx.addOperation(Operation.createAccount({
        source: creatorKeypair.publicKey(),
        destination: issuerKeypair.publicKey(),
        startingBalance: '3.54336' //17 * MAX_ISSUED + 1
    }));

    tx.addOperation(Operation.beginSponsoringFutureReserves({
        source: issuerKeypair.publicKey(),
        sponsoredId: ticketsKeypair.publicKey()
    }));

    tx.addOperation(Operation.createAccount({
        source: creatorKeypair.publicKey(),
        destination: ticketsKeypair.publicKey(),
        startingBalance: '0'
    }));

    tx.addOperation(Operation.endSponsoringFutureReserves({
        source: ticketsKeypair.publicKey()
    }));

    tx = tx.setTimeout(0).build();

    tx.sign(creatorKeypair);
    tx.sign(ticketsKeypair);
    tx.sign(issuerKeypair);

    try {
        const txResult = await server.submitTransaction(tx);
        //console.log(JSON.stringify(txResult, null, 2));
        console.log('Success! View the transaction at: ');
        console.log(txResult._links.transaction.href);

        return txResult.hash;
    } catch (e) {
        console.log('An error has occured:');
        //console.log(e)
        //console.log(e.response.data);
        console.log(e.response.data.extras.result_codes);
    }

})()
