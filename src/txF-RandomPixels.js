'use strict';
const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

import util from 'util'
import { TransactionBuilder, Server, Networks, Operation, Asset, Keypair, StrKey } from 'stellar-sdk'
import BigNumber from 'bignumber.js';
import fetch from 'node-fetch';
import { encode } from 'fast-png';

const server = new Server(HORIZON_URL);
const ticketIssuerPK = 'GBJSG34XIZ7W4TG6W6JSUFUZSEERG3NRTITFXZVOTMTP43NWR7CAICJG';
const ticketsPK = 'GBCZBKEWQGHXMC744K6OOVF5XYE4YHUJKLPKQKYLZWSGIEMLXBGD6A2Y';
const issuerPK = 'GAEAHPQC4T726JKCGRMLG36V6OA7KFMKCFYM6JZWWYDBHF6NHYBH2Y3D';
const feeAccountPK = 'GCTL2ZFFYQLFNTGTC27Q3GLLE5OX4UC7HDE6WW3CDPPZ6O7DTO23H543';

const UINT8MAX = Math.pow(2, 8);
const UINT64MAX = Math.pow(2, 64);

export default async (body) => {
    const { stage, source } = body;

    console.log("stage:", stage);
    console.log("source:", source);

    if (
        source === ticketIssuerPK
        || source === ticketsPK
        || source === issuerPK
    ) throw {message: 'Invalid source account'}

    switch(stage) {
        case 'issueTicket':
          return issueTicket(body);

        case 'generateNFT':
          return generateNFT(body);

        default:
          throw {message: 'Invalid stage.'}
        }
}

async function issueTicket(body) {
    const { source, width, height, pixelPrice, timestamp } = body

    if (width < 0 || width >= UINT8MAX)
        throw {message: 'Invalid width.'}

    if (height < 0 || height >= UINT8MAX)
        throw {message: 'Invalid height.'}

    if (pixelPrice < 0.01 || pixelPrice >= 999999)
        throw {message: 'Invalid price.'}

    if (timestamp < 0 || timestamp >= UINT64MAX)
        throw {message: 'Invalid timestamp.'}

    // This should be set to something small like 1000 (1s). This was my first idea on how to
    // implement randomness - to use timestamp as a seed to PRNG. Timestamp would be taken before
    // the txFunctions are executed on turrets and used as an input. While running the txFunction on
    // turrets, it's checked if this timestamp (seed) is recent, otherwise people could input anything
    // as seed and manipulate the randomness. This way there's still some possibility for
    // manipulation, but much lower.
    //
    // This seed is used only in the 2nd part to generate the image, so better solution would be
    // to use the transaction hash from the ticket issuance.
    if (Date.now() - timestamp > 60000)
        throw {message: 'Too slow. Run window has expired.'}

    const nftData = encodeNftData(source, width, height, pixelPrice, timestamp);

    const finalPrice = new BigNumber(pixelPrice).times(width).times(height).toFixed(0, 2);

    const account = await server.loadAccount(source);
    const fee = await getFee();

    let issuedAssetsCounter = 0;
    const ticketIssuerAccount = await server.loadAccount(ticketIssuerPK);
    if(typeof ticketIssuerAccount.data_attr.issuedAssetsCounter !== "undefined"){
        const issuedAssetsCounterStr = Buffer.from(ticketIssuerAccount.data_attr.issuedAssetsCounter, 'base64').toString('utf-8');
        issuedAssetsCounter = parseInt(issuedAssetsCounterStr) || 0;
    }

    const number = (issuedAssetsCounter < 10) ? "0" + issuedAssetsCounter : "" + issuedAssetsCounter;

    const assetCode = 'RndPxls' + number;
    console.log("assetCode:", assetCode);

    const ticketAsset = new Asset("ticket" + number, ticketIssuerPK);

    // if (issuedAssetsCounter > 99){
    //     console.log("You can't issue more RndPxls. 100 RndPxls has already beed issued.");
    //     throw {message: "You can't issue more RndPxls. 100 RndPxls has already beed issued."}
    // }

    const ticketsAccount = await server.loadAccount(ticketsPK);
    const nftDataDict = ticketsAccount.data_attr;

    if (hasTicket(source, nftDataDict)){
        throw {message: "Source account has an open ticket."}
    }


    let transaction = new TransactionBuilder(account, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    transaction.addOperation(Operation.changeTrust({
        asset: ticketAsset,
        limit: '0.0000001',
        source: ticketsPK
    }));

    transaction.addOperation(Operation.payment({
        source: ticketIssuerPK,
        destination: ticketsPK,
        asset: ticketAsset,
        amount: '0.0000001'
    }));

    transaction.addOperation(Operation.payment({
        source: source,
        destination: feeAccountPK,
        asset: Asset.native(),
        amount: finalPrice
    }));

    transaction.addOperation(Operation.manageData({
        source: ticketsPK,
        name: assetCode,
        value: nftData
    }));

    transaction.addOperation(Operation.manageData({
        source: ticketIssuerPK,
        name: "issuedAssetsCounter",
        value: (issuedAssetsCounter + 1).toString()
    }));

    return transaction.setTimeout(0).build().toXDR('base64');
}

async function generateNFT(body) {
    const { source, hostIpfs, authIpfs, seed } = body

    const account = await server.loadAccount(source);
    const ticketIssuerAccount = await server.loadAccount(ticketIssuerPK);
    const ticketsAccount = await server.loadAccount(ticketsPK);
    const fee = await getFee();

    const nftDataDict = ticketsAccount.data_attr;
    const { assetCode, width, height, pixelPrice, timestamp } = getNftData(source, nftDataDict);

    const seedKeypairRawPK = Keypair.fromPublicKey(seed).rawPublicKey();
    const nftKeypair = Keypair.fromRawEd25519Seed(seedKeypairRawPK);

    const nftAsset = new Asset(assetCode, nftKeypair.publicKey());
    console.log("assetCode:", assetCode);

    const image = generateImage(width, height, Number(timestamp));
    const response = await uploadFileToIpfs(image, hostIpfs, authIpfs);
    const ipfsHash = response.Hash;
    console.log("ipfsHash:", ipfsHash);


    let transaction = new TransactionBuilder(account, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    transaction.addOperation(Operation.beginSponsoringFutureReserves({
        source: source,
        sponsoredId: nftKeypair.publicKey()
    }))

    transaction.addOperation(Operation.createAccount({
        source: issuerPK,
        destination: nftKeypair.publicKey(),
        startingBalance: '0'
    }))

    transaction.addOperation(Operation.changeTrust({
        source: source,
        asset: nftAsset,
        limit: '0.0000001'
    }))

    transaction.addOperation(Operation.payment({
        source: nftKeypair.publicKey(),
        destination: source,
        asset: nftAsset,
        amount: '0.0000001'
    }));

    transaction.addOperation(Operation.manageData({
        source: nftKeypair.publicKey(),
        name: "ipfshash",
        value: ipfsHash
    }));

    transaction.addOperation(Operation.manageData({
        source: nftKeypair.publicKey(),
        name: "data",
        value: encodeNftData(source, width, height, pixelPrice, timestamp)
    }));

    transaction.addOperation(Operation.manageData({
        source: ticketsPK,
        name: assetCode,
        value: null
    }));

    transaction.addOperation(Operation.setOptions({
        masterWeight: 0,
        source: nftKeypair.publicKey()
    }));

    transaction.addOperation(Operation.endSponsoringFutureReserves({
        source: nftKeypair.publicKey()
    }));

    transaction = transaction.setTimeout(0).build();
    transaction.sign(nftKeypair);

    return transaction.toXDR('base64');
}

function hasTicket(source, nftDataDict){
    for (const assetCode in nftDataDict){
        const nftDataBuffer = Buffer.from(nftDataDict[assetCode], 'base64');
        const { pk, width, height, pixelPrice, timestamp } = decodeNftData(nftDataBuffer);
        if (pk == source) {
            return true;
        }
    }
    return false;
}

function getNftData(source, nftDataDict){
    for (const assetCode in nftDataDict){
        const nftDataBuffer = Buffer.from(nftDataDict[assetCode], 'base64');
        const { pk, width, height, pixelPrice, timestamp } = decodeNftData(nftDataBuffer);
        if (pk == source) {
            return { assetCode, width, height, pixelPrice, timestamp }
        }
    }
    throw {message: "This account doesn't have an unissued ticket."}
}

function encodeNftData(pk, width, height, pixelPrice, timestamp) {
    const pkBuffer = Keypair.fromPublicKey(pk).rawPublicKey();

    const paramsBuffer = Buffer.alloc(32);
    paramsBuffer.writeUInt8(width, 1);
    paramsBuffer.writeUInt8(height, 2);
    paramsBuffer.writeFloatBE(pixelPrice, 3);
    paramsBuffer.writeBigInt64BE(BigInt(timestamp), 7);

    return Buffer.concat([pkBuffer, paramsBuffer]);
}

function decodeNftData(buffer) {
    const pk = StrKey.encodeEd25519PublicKey(buffer.subarray(0, 32));

    const paramsBuffer = buffer.subarray(32);
    const width = paramsBuffer.readUInt8(1);
    const height = paramsBuffer.readUInt8(2);
    const pixelPrice = paramsBuffer.readFloatBE(3);
    const timestamp = paramsBuffer.readBigInt64BE(7);

    return { pk, width, height, pixelPrice, timestamp };
}

const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
function createBoundary() {
    let size = 16;
    let res = "";
    while (size--) {
        res += alphabet[(Math.random() * alphabet.length) << 0];
    }
    return "form-data-boundary-" + res;
}

function normalize(value) {
    return String(value).replace(/\r(?!\n)|(?<!\r)\n/g, "\r\n");
}

function createHeadersAndBody(file) {
    const boundary = createBoundary()
    const meta = 'Content-Disposition: form-data; name="file"';
    const encoder = new util.TextEncoder()
    const fstr = Buffer.from(encoder.encode(normalize(file))).toString()
    const da = "\u000D\u000A";

    const body = `--${boundary}${da}${meta}${da}${da}${fstr}${da}--${boundary}--${da}${da}`

    let headers = {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.from(body, 'utf8').length.toString()
    }

    return { headers, body }
}

async function uploadFileToIpfs(file, hostIpfs, authIpfs){
    const urlIpfs = hostIpfs + '/api/v0/add';

    let { headers, body } = createHeadersAndBody(file);
    let bodyBuffer = Buffer.from(body, 'utf8');

    const response = await fetch(urlIpfs, {
        method: 'POST',
        auth: authIpfs,
        headers: headers,
        body: bodyBuffer
    })
    .then(async (res) => {
        console.log(res)

        if (res.ok)
            return res.json()
        else
            throw await res.text()
    })

    return response
};

function generateImage(w, h, seed) {
  let random = new SFMT(seed);
  let max_32bit_int = Math.pow(2, 32) - 1;
  let numChannels = 4;

  let buffer = Buffer.alloc(w * h * numChannels)

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx = (w * y + x) << 2;
      //let r = (random.GetNext32Bit() / max_32bit_int) * 255;
      //let gb = (random.GetNext32Bit() / max_32bit_int) * r;
      buffer[idx] = (random.GetNext32Bit() / max_32bit_int) * 255;
      buffer[idx + 1] = (random.GetNext32Bit() / max_32bit_int) * 255;
      buffer[idx + 2] = (random.GetNext32Bit() / max_32bit_int) * 255;
      buffer[idx + 3] = 255;
    }
  }

  let png = encode({
    width: w,
    height: h,
    data: buffer,
    depth: 8,
    channels: numChannels
  })

  return Buffer.from(png)
};

function getFee() {
  return server
  .feeStats()
  .then((feeStats) => feeStats?.fee_charged?.max || 100000)
  .catch(() => 100000)
};

class SFMT {

    constructor(seed) {
        this.MEXP = 19937;
        this.SL1 = 18;
        this.SR1 = 11;
        this.MSK1 = 0xdfffffef;
        this.MSK2 = 0xddfecb7f;
        this.MSK3 = 0xbffaffff;
        this.MSK4 = 0xbffffff6;
        this.PARITY1 = 0x00000001;
        this.PARITY2 = 0x00000000;
        this.PARITY3 = 0x00000000;
        this.PARITY4 = 0x13c9e684;
        this.N = 156;
        this.N32 = 624;
        this.Initialize(seed);
    }

    GetNext64Bit() {
        var lower = this.GetNext32Bit();
        var upper = this.GetNext32Bit();
        return [ upper, lower ];
    }

    GetNext32Bit() {
        //Checks if current array has been used fully and needs reshuffle
        if (this.idx >= this.N32) {
            this.Shuffle();
            this.idx = 0;
        }
        return this.sfmt[this.idx++];
    }

    Initialize(seed) {
        var s;
        this.sfmt = new Uint32Array(this.N32);
        this.sfmt[0] = seed;
        //Initializes the SFMT array
        for (let i = 1; i < this.N32; i++) {
            s = this.sfmt[i - 1] ^ (this.sfmt[i - 1] >>> 30);
            this.sfmt[i] = ((((s >>> 16) * 0x6C078965) << 16) + (s & 0xffff) * 0x6C078965) + i;
        }
        this.Certify();
        this.idx = this.N32;
    }

    Certify() {
        var PARITY = new Uint32Array(4);
        PARITY[0] = this.PARITY1;
        PARITY[1] = this.PARITY2;
        PARITY[2] = this.PARITY3;
        PARITY[3] = this.PARITY4;
        var i, j;
        var work, inner;

        for (i = 0; i < 4; i++)
            inner ^= this.sfmt[i] & PARITY[i];

        for (i = 16; i > 0; i >>= 1)
            inner ^= inner >> i;

        inner &= 1;

        if (inner == 1)
            return;

        for (i = 0; i < 4; i++) {
            work = 1;
            for (j = 0; j < 32; j++) {
                if ((work & PARITY[i]) != 0) {
                    this.sfmt[i] = (this.sfmt[i] ^ work) >>> 0;
                    return;
                }
                work = work << 1;
            }
        }
    }

    Advance(frames) {
        this.idx += frames * 2;
        while (this.idx > 624) {
            this.idx -= 624;
            this.Shuffle();
        }
    }

    Shuffle() {
        var a, b, c, d;

        a = 0;
        b = 488;
        c = 616;
        d = 620;

        //Reshuffles the SFMT array
        do {
            this.sfmt[a + 3] = this.sfmt[a + 3] ^ (this.sfmt[a + 3] << 8) ^ (this.sfmt[a + 2] >>> 24) ^ (this.sfmt[c + 3] >>> 8) ^ (((this.sfmt[b + 3] >>> this.SR1) & this.MSK4) >>> 0) ^ (this.sfmt[d + 3] << this.SL1);
            this.sfmt[a + 2] = this.sfmt[a + 2] ^ (this.sfmt[a + 2] << 8) ^ (this.sfmt[a + 1] >>> 24) ^ (this.sfmt[c + 3] << 24) ^ (this.sfmt[c + 2] >>> 8) ^ (((this.sfmt[b + 2] >>> this.SR1) & this.MSK3) >>> 0) ^ (this.sfmt[d + 2] << this.SL1);
            this.sfmt[a + 1] = this.sfmt[a + 1] ^ (this.sfmt[a + 1] << 8) ^ (this.sfmt[a + 0] >>> 24) ^ (this.sfmt[c + 2] << 24) ^ (this.sfmt[c + 1] >>> 8) ^ (((this.sfmt[b + 1] >>> this.SR1) & this.MSK2) >>> 0) ^ (this.sfmt[d + 1] << this.SL1);
            this.sfmt[a + 0] = this.sfmt[a + 0] ^ (this.sfmt[a + 0] << 8) ^ (this.sfmt[c + 1] << 24) ^ (this.sfmt[c + 0] >>> 8) ^ (((this.sfmt[b + 0] >>> this.SR1) & this.MSK1) >>> 0) ^ (this.sfmt[d + 0] << this.SL1);
            c = d;
            d = a;
            a += 4;
            b += 4;
            if (b >= this.N32)
                b = 0;
        } while (a < this.N32);
    }
}
