const { Server, Transaction, Networks, Keypair } = require('stellar-sdk');

const HORIZON_URL = 'https://horizon-testnet.stellar.org'

const { xdr, signer, signature } = {
    "xdr": "AAAAAgAAAABbjAyP9h/66ow4t1Uqgo6hTQED9/iXqA2DVDsw2jI9UQAAA4QADh6HAAAABAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAkAAAABAAAAAFuMDI/2H/rqjDi3VSqCjqFNAQP3+JeoDYNUOzDaMj1RAAAAEAAAAACrKWHIUNRa5FQB3teBf/Nl6BJzSnRNW649X8sCBzQeFAAAAAEAAAAAW4wMj/Yf+uqMOLdVKoKOoU0BA/f4l6gNg1Q7MNoyPVEAAAAAAAAAAKspYchQ1FrkVAHe14F/82XoEnNKdE1brj1fywIHNB4UAAAAAAAAAAAAAAABAAAAAH+VQ5tf7yHFpyPApIaAq2pXNdiF3wTGkQCaVs2uxCBfAAAABgAAAAJSbmRQeGxzMDAxAAAAAAAAqylhyFDUWuRUAd7XgX/zZegSc0p0TVuuPV/LAgc0HhQAAAAAAAAAAQAAAAEAAAAAqylhyFDUWuRUAd7XgX/zZegSc0p0TVuuPV/LAgc0HhQAAAABAAAAAH+VQ5tf7yHFpyPApIaAq2pXNdiF3wTGkQCaVs2uxCBfAAAAAlJuZFB4bHMwMDEAAAAAAACrKWHIUNRa5FQB3teBf/Nl6BJzSnRNW649X8sCBzQeFAAAAAAAAAABAAAAAQAAAAC++Ynk+O5dxV8+buTaxbUbED9vmuWbUiKBYIdgiPPC6AAAAAoAAAAJdGlja2V0MDAxAAAAAAAAAAAAAAEAAAAAqylhyFDUWuRUAd7XgX/zZegSc0p0TVuuPV/LAgc0HhQAAAAKAAAACGlwZnNoYXNoAAAAAQAAAC5RbVNDUGh0NXZyODMxRjlXQWVDWDZzREJjSnBXUDlTV05ZaW0yYXZZbWtkaTRZAAAAAAABAAAAAKspYchQ1FrkVAHe14F/82XoEnNKdE1brj1fywIHNB4UAAAACgAAAARkYXRhAAAAAQAAAEB/lUObX+8hxacjwKSGgKtqVzXYhd8ExpEAmlbNrsQgXwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAACrKWHIUNRa5FQB3teBf/Nl6BJzSnRNW649X8sCBzQeFAAAAAUAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAACrKWHIUNRa5FQB3teBf/Nl6BJzSnRNW649X8sCBzQeFAAAABEAAAAAAAAAAQc0HhQAAABAbPDvH7+6aPkhc7hGdQ55O+4WMNH+R67kWWl8PIpL2zI1hxvgHe3nexYX8c1VqEOrBGkZRQbzinGyPGtHpfp0BQ==",
    "signer": "GDGKU2YTAOCKF4HOLVQRX5YF6KMNFFS62V25RRWCI66ADH2CZNHD7HTG",
    "signature": "5vucIJbhXGcwRRwbkXYSQLU24b2/MSLLkSnprb4EvYCnn0S4rhaQS3+7Fzf/YGFjfpTEyJr4Hc/gbNC+3iZnDw==",
    "cost": "0.0029580",
    "feeSponsor": "GAFDEKY3TLXP2OWXZTSGVXH7GFBIUAAKZVOVJBKFBZD3Y3QCDIETFFAZ",
    "feeBalanceRemaining": "9.9942400"
}

const tx = new Transaction(xdr, Networks.TESTNET);

const sourceKeypair = Keypair.fromSecret("SCGO6PBGGJ3YHRQA74WJXZ76A4LAB5BISTPUETCO5RKFNMZZAV3PZLOZ");

tx.addSignature(signer, signature);
tx.sign(sourceKeypair);
console.log("XDR:", tx.toXDR());

const server = new Server(HORIZON_URL);

(async () => {
    try {
      const txResult = await server.submitTransaction(tx);
      //console.log(JSON.stringify(txResult, null, 2));
      console.log('\nSuccess! View the transaction at: ');
      console.log(txResult._links.transaction.href);
    } catch (e) {
      console.log('\nAn error has occured:');
      console.log(e);
      //console.log(e.response.data);
      //console.log(e.response.data.extras.result_codes);
    }
})()
