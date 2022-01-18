const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

const { Keypair, Networks, Transaction, Server } = require('stellar-sdk');

const server = new Server(HORIZON_URL);
const ticketsPK = 'GD3UBB27WLVHRJBXCBFP7AXU7EUVBTIIPHLNTR6AEBWTAP4BOVE6BF5Z';
const issuerPK = 'GDNFM3ZEBM5CMFNWGN4K7N7U2GOGEHJBOETRGYNWGSU2WS6U3TZLQUMK';
const feeAccountPK = 'GCTL2ZFFYQLFNTGTC27Q3GLLE5OX4UC7HDE6WW3CDPPZ6O7DTO23H543';

async function getXlmBalance(pk) {
    const acc = await server.loadAccount(pk);
    const balance = acc.balances.find(e => e.asset_type == "native")["balance"]
    const numSponsoring = acc.num_sponsoring;
    return [ balance, numSponsoring ]
}

async function getStartingXlmBalance(pk) {
    const createAccOp = await server.operations().forAccount(pk).order("asc").limit(1).call();
    return createAccOp.records[0].starting_balance
}

(async () => {
    // const feeAccountStartingBalance = await getStartingXlmBalance(feeAccountPK);
    // const issuerAccountStartingBalance = await getStartingXlmBalance(issuerPK);
    //
    // const [ feeAccountBalance, feeAccountnumSponsoring ] = await getXlmBalance(feeAccountPK);
    // const [ issuerAccountBalance, issuerAccountnumSponsoring ] = await getXlmBalance(issuerPK);
    //
    // console.log("feeAccountStartingBalance:", feeAccountStartingBalance);
    // console.log("issuerAccountStartingBalance:", issuerAccountStartingBalance);
    //
    // console.log("feeAccountBalance:", feeAccountBalance);
    // console.log("issuerAccountBalance:", issuerAccountBalance);
    //
    // console.log("feeAccountnumSponsoring:", feeAccountnumSponsoring);
    // console.log("issuerAccountnumSponsoring:", issuerAccountnumSponsoring);
    // //const tx = txs["records"][0];
    // //console.log(ops);
    // //const ops = await tx.operations();
    // //console.log(ops);
    //
    // const acc = await server.loadAccount(issuerPK);
    // const numIssuedAssets = Buffer.from(acc.data_attr.numIssuedAssets, 'base64').toString('utf-8');
    //
    // const currentBalance = parseFloat(feeAccountBalance) + parseFloat(issuerAccountBalance);
    // const locked = (feeAccountnumSponsoring + issuerAccountnumSponsoring) * 0.5;
    // const profit = currentBalance - feeAccountStartingBalance - locked;
    //
    // console.log("numIssuedAssets:", numIssuedAssets);
    // console.log("starting balance:", feeAccountStartingBalance);
    // console.log("current balance:", currentBalance);
    // console.log("profit:", profit)
    // console.log("locked:", locked);

    // const txs = await server.transactions().forAccount(issuerPK).order("desc").limit(10).call();
    // for (let i = 0; i < txs["records"].length; i++) {
    //     let tx = txs.records[i];
    //     //console.log(tx.hash, tx.operation_count);
    //     if (tx.operation_count == 9) {
    //         const ops = await tx.operations();
    //         console.log("======");
    //
    //         const paymentOp = ops.records[3];
    //         if (paymentOp.type == "payment") {
    //             console.log("code:", paymentOp.asset_code)
    //             console.log("issuer:", paymentOp.asset_issuer)
    //         }
    //
    //         const manageDataOp = ops.records[5];
    //         if (manageDataOp.type == "manage_data") {
    //             console.log("source:", manageDataOp.source_account)
    //             console.log("ipfs hash:", manageDataOp.value)
    //         }
    //
    //     }
    // }

    var callback = async function (tx) {
        if (tx.operation_count == 9) {
            const ops = await tx.operations();
            console.log("======");

            const paymentOp = ops.records[3];
            if (paymentOp.type == "payment") {
                console.log("code:", paymentOp.asset_code)
                console.log("issuer:", paymentOp.asset_issuer)
            }

            const manageDataOp = ops.records[5];
            if (manageDataOp.type == "manage_data") {
                console.log("source:", manageDataOp.source_account)
                console.log("ipfs hash:", manageDataOp.value)
            }
        }
    };

    var es = server
      .transactions()
      .forAccount(issuerPK)
      .stream({ onmessage: callback });



})();
