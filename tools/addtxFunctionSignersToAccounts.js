const { Transaction, Server, Networks, Keypair, BASE_FEE, TransactionBuilder, Operation } = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

const feeKeypair = Keypair.fromSecret("SCSTJAXINEIEBPXJQATERMWNBDY7G6MUANGJHV33I5666TJ4Z4FJAP3C");
const ticketsKeypair = Keypair.fromSecret("SDLE45BGYB7U6SG23CUQDSXJDKESNDLIEAEO7TC4BDYSPU2X5FF4RP4M");
const issuerKeypair = Keypair.fromSecret("SCT4XB4PJ2TWMF7N3HVVLFWO7VMMZVNFQFHZJ6L6QK4IO56523GEMDER");

// Issuer:
// public: GDNFM3ZEBM5CMFNWGN4K7N7U2GOGEHJBOETRGYNWGSU2WS6U3TZLQUMK
// secret: SCT4XB4PJ2TWMF7N3HVVLFWO7VMMZVNFQFHZJ6L6QK4IO56523GEMDER
// Tickets:
// public: GD3UBB27WLVHRJBXCBFP7AXU7EUVBTIIPHLNTR6AEBWTAP4BOVE6BF5Z
// secret: SDLE45BGYB7U6SG23CUQDSXJDKESNDLIEAEO7TC4BDYSPU2X5FF4RP4M

const keypairs = [ticketsKeypair, issuerKeypair];
const signers = [
    "GDANHSNTKZUNFCPFJKTYCLVUML74VV7A7FOBKXWKALOOMO6ENVKLBW4M",
    "GC2X3MTT4U5EEXH5B3WL6WNCNK2BAYSLIJSSRLR7H4FT36HIWFMENE6X"
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
