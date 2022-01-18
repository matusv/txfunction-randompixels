'use strict';
const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const STELLAR_NETWORK = 'TESTNET'

import { TransactionBuilder, Server, Networks, Operation, Asset, Keypair, StrKey } from 'stellar-sdk'
import BigNumber from 'bignumber.js';
import fetch from 'node-fetch';
import { encode } from 'fast-png';

const server = new Server(HORIZON_URL);
const ticketsPK = 'GD3UBB27WLVHRJBXCBFP7AXU7EUVBTIIPHLNTR6AEBWTAP4BOVE6BF5Z';
const issuerPK = 'GDNFM3ZEBM5CMFNWGN4K7N7U2GOGEHJBOETRGYNWGSU2WS6U3TZLQUMK';
const feeAccountPK = 'GCTL2ZFFYQLFNTGTC27Q3GLLE5OX4UC7HDE6WW3CDPPZ6O7DTO23H543';

const MAX_UINT_8 = Math.pow(2, 8) - 1;
const MAX_ISSUED = 255;

export default async (body) => {
    const { stage, source } = body;

    if (source === issuerPK ||
        source === ticketsPK ||
        source === feeAccountPK)
        throw {message: 'Invalid source account'}

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
    const { source, sizeIdx, numColors, symmetryDepth, clean, tip, expectedPrice } = body

    if ((typeof sizeIdx !== "undefined") && (!Number.isInteger(sizeIdx) || (sizeIdx < 0 || sizeIdx > MAX_UINT_8)))
        throw {message: 'Invalid sizeIdx.'}

    if ((typeof numColors !== "undefined") && (!Number.isInteger(numColors) || (numColors < 0 || numColors > MAX_UINT_8)))
        throw {message: 'Invalid numColors.'}

    if ((typeof symmetryDepth !== "undefined") && (!Number.isInteger(symmetryDepth) || (symmetryDepth < 0 || symmetryDepth > MAX_UINT_8)))
        throw {message: 'Invalid symmetryDepth.'}

    if ((typeof clean !== "undefined") && (typeof clean !== "boolean"))
        throw {message: 'Invalid clean.'}

    if ((typeof tip !== "undefined") && (!Number.isInteger(tip) || (tip < 0 || tip > MAX_UINT_8)))
        throw {message: 'Invalid tip.'}

    const nftData = encodeNftData(source, sizeIdx, numColors, symmetryDepth, clean, tip);

    const price = computePrice(sizeIdx, numColors, symmetryDepth, clean, tip);

    //2.5 XLM is going to get sent to the issuer because it's going to get locked in the NFT creation.
    const lockedAmount = 2.5;
    if (price != (expectedPrice - lockedAmount) + "")
        throw {message: 'Invalid expected price.'}

    const account = await server.loadAccount(source);
    const fee = await getFee();

    let numIssuedAssets = 0;
    const issuerAccount = await server.loadAccount(issuerPK);
    if(typeof issuerAccount.data_attr.numIssuedAssets !== "undefined"){
        const numIssuedAssetsStr = Buffer.from(issuerAccount.data_attr.numIssuedAssets, 'base64').toString('utf-8');
        numIssuedAssets = parseInt(numIssuedAssetsStr) || 0;
    }

    let ordNumStr = null;
    if (numIssuedAssets < 10) ordNumStr = "00" + numIssuedAssets;
    else if (numIssuedAssets < 100) ordNumStr = "0" + numIssuedAssets;
    else  ordNumStr = "" + numIssuedAssets;

    const ticketAssetCode = 'ticket' + ordNumStr;
    const ticketAsset = new Asset(ticketAssetCode, issuerPK);

    if (numIssuedAssets >= MAX_ISSUED){
        throw {message: "Maximum amount of RndPxls has been issued."}
    }

    const ticketsAccount = await server.loadAccount(ticketsPK);
    const nftDataDict = ticketsAccount.data_attr;

    if (hasTicket(source, nftDataDict)){
        throw {message: "Source account has an open ticket."}
    }

    let transaction = new TransactionBuilder(issuerAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    transaction.addOperation(Operation.beginSponsoringFutureReserves({
        source: issuerPK,
        sponsoredId: ticketsPK
    }))

    transaction.addOperation(Operation.changeTrust({
        asset: ticketAsset,
        limit: '0.0000001',
        source: ticketsPK
    }));

    transaction.addOperation(Operation.payment({
        source: issuerPK,
        destination: ticketsPK,
        asset: ticketAsset,
        amount: '0.0000001'
    }));

    transaction.addOperation(Operation.payment({
        source: source,
        destination: feeAccountPK,
        asset: Asset.native(),
        amount: price
    }));

    transaction.addOperation(Operation.payment({
        source: source,
        destination: issuerPK,
        asset: Asset.native(),
        amount: '2.5'
    }));

    transaction.addOperation(Operation.manageData({
        source: ticketsPK,
        name: ticketAssetCode,
        value: nftData
    }));

    transaction.addOperation(Operation.manageData({
        source: issuerPK,
        name: "numIssuedAssets",
        value: (numIssuedAssets + 1).toString()
    }));

    transaction.addOperation(Operation.endSponsoringFutureReserves({
        source: ticketsPK
    }));

    return transaction.setTimeout(0).build().toXDR('base64');
}

async function generateNFT(body) {
    const { source, hostIpfs, authIpfs, ticketTxHash, nftIssuerSeed } = body

    const ticketTx = await server.transactions().transaction(ticketTxHash).call();

    if (ticketTx.source_account != issuerPK)
        throw {message: "Issuer public key and source account of 'ticketTxHash' must equal."}

    const ticketOps = await ticketTx.operations();
    const ticketAssetCode = ticketOps.records[1].asset_code;

    if (ticketOps.records[2].from != issuerPK || ticketOps.records[2].to != ticketsPK)
        throw {message: "Invalid issue ticket operation."}

    if (ticketOps.records[3].from != source || ticketOps.records[3].to != feeAccountPK)
        throw {message: "Invalid fee payment operation."}

    const account = await server.loadAccount(source);
    const issuerAccount = await server.loadAccount(issuerPK);
    const ticketsAccount = await server.loadAccount(ticketsPK);
    const fee = await getFee();

    const nftDataDict = ticketsAccount.data_attr;
    if (!(ticketAssetCode in nftDataDict))
        throw {message: `Source account doesn't have an open ticket "${ticketAssetCode})".`}

    const { pk, sizeIdx, numColors, symmetryDepth, clean, tip } = decodeNftData(Buffer.from(nftDataDict[ticketAssetCode], 'base64'));

    const seedKeypairRawPK = Keypair.fromPublicKey(nftIssuerSeed).rawPublicKey();
    const nftKeypair = Keypair.fromRawEd25519Seed(seedKeypairRawPK);

    const ordNumStr = ticketAssetCode.substr(-3);
    const ordNum = parseInt(ordNumStr);
    const assetCode = "RndPxls" + ordNumStr;
    const nftAsset = new Asset(assetCode, nftKeypair.publicKey());
    const imageSeed = Buffer.from(ticketTxHash, 'hex').slice(-4).readUInt32BE(0);

    const image = generateImage(ordNum, imageSeed, { sizeIdx, numColors, symmetryDepth, clean, tip });
    const response = await uploadFileToIpfs(image, hostIpfs, authIpfs);
    const ipfsHash = response.Hash;

    let transaction = new TransactionBuilder(issuerAccount, {
        fee,
        networkPassphrase: Networks[STELLAR_NETWORK]
    });

    transaction.addOperation(Operation.beginSponsoringFutureReserves({
        source: issuerPK,
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
        source: ticketsPK,
        name: ticketAssetCode,
        value: null
    }));

    transaction.addOperation(Operation.manageData({
        source: nftKeypair.publicKey(),
        name: "ipfshash",
        value: ipfsHash
    }));

    transaction.addOperation(Operation.manageData({
        source: nftKeypair.publicKey(),
        name: "data",
        value: encodeNftData(source, sizeIdx, numColors, symmetryDepth, clean, tip)
    }));

    transaction.addOperation(Operation.setOptions({
        masterWeight: 0,
        homeDomain: "hashbrownies.io",
        source: nftKeypair.publicKey()
    }));

    transaction.addOperation(Operation.endSponsoringFutureReserves({
        source: nftKeypair.publicKey()
    }));

    if (ordNum == MAX_ISSUED - 1) {
        transaction.addOperation(Operation.payment({
            source: issuerPK,
            destination: feeAccountPK,
            asset: Asset.native(),
            amount: "1"
        }));
    }

    transaction = transaction.setTimeout(0).build();
    transaction.sign(nftKeypair);

    return transaction.toXDR('base64');
}

function computePrice(sizeIdx, numColors, symmetryDepth, clean, tip){
    let price = new BigNumber(2.5);

    if ((typeof sizeIdx !== "undefined")) price = price.plus(5);
    if ((typeof numColors !== "undefined")) price = price.plus(5);
    if ((typeof symmetryDepth !== "undefined")) price = price.plus(5);
    if ((typeof clean !== "undefined")) price = price.plus(5);
    if ((typeof tip !== "undefined")) price = price.plus(tip);

    return price.toFixed(1, 2);
}

function hasTicket(source, nftDataDict){
    for (const assetCode in nftDataDict){
        const nftDataBuffer = Buffer.from(nftDataDict[assetCode], 'base64');
        const { pk, sizeIdx, numColors, symmetryDepth, clean, tip } = decodeNftData(nftDataBuffer);
        if (pk == source)
            return true;
    }
    return false;
}

function encodeNftData(pk, sizeIdx, numColors, symmetryDepth, clean, tip) {
    const pkBuffer = Keypair.fromPublicKey(pk).rawPublicKey();
    const buffer = Buffer.alloc(32);

    let arr = [sizeIdx, numColors, symmetryDepth, clean, tip];
    let flags = 0;

    for (let i = 0; i < arr.length; i++){
        if (!(typeof arr[i] == "undefined")){
            buffer.writeUInt8(arr[i], i + 2);
            flags += 1 << i;
        }
    }

    buffer.writeUInt16BE(flags, 0);
    return Buffer.concat([pkBuffer, buffer]);
}

function decodeNftData(buffer) {
    const pk = StrKey.encodeEd25519PublicKey(buffer.subarray(0, 32));
    const flags = buffer.readUInt16BE(32);

    let sizeIdx, numColors, symmetryDepth, clean, tip;
    let arr = [sizeIdx, numColors, symmetryDepth, clean, tip];

    for (let i = 0; i < arr.length; i++){
        if (flags & (1 << i))
            arr[i] = buffer.readUInt8(32 + i + 2);
    }

    [ sizeIdx, numColors, symmetryDepth, clean, tip ] = arr;
    return { pk, sizeIdx, numColors, symmetryDepth, clean, tip };
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

function createHeadersAndBody(file) {
    const boundary = createBoundary()

    const da = "\u000D\u000A";
    const meta = `Content-Disposition: form-data; name="img"${da}Content-Type: application/octet-stream`;
    const header = `--${boundary}${da}${meta}${da}${da}`;
    const footer = `${da}--${boundary}--${da}${da}`;

    var chunks = [
        Buffer.from(header, "utf-8"),
        file,
        Buffer.from(footer, "utf-8")
    ];

    const bodyBuffer = Buffer.concat(chunks);

    let headers = {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length.toString()
    }

    return { headers, bodyBuffer }
}

async function uploadFileToIpfs(file, hostIpfs, authIpfs){
    const urlIpfs = hostIpfs + '/api/v0/add';

    let { headers, bodyBuffer } = createHeadersAndBody(file);

    const response = await fetch(urlIpfs, {
        method: 'POST',
        auth: authIpfs,
        headers: headers,
        body: bodyBuffer
    })
    .then(async (res) => {
        if (res.ok)
            return res.json()
        else
            throw await res.text()
    })

    return response
};

function getFee() {
  return server
  .feeStats()
  .then((feeStats) => feeStats?.fee_charged?.max || 100000)
  .catch(() => 100000)
};

const MAX_UINT_32 = Math.pow(2, 32) - 1;
const NUM_CHANNELS = 3;

class Random {
    constructor (seed) {
        this.MAX_UINT_32 = Math.pow(2, 32);
        this.sfmt = new SFMT(seed);
    }

    randomUInt (min, max) {
        return (min + (this.sfmt.GetNext32Bit() / this.MAX_UINT_32) * (max - min)) | 0
    }
}

function sigmoid(x){
    return 1 / (1 + Math.E ** (-(x - 64) / 13))
}

function generateRandom(w, h, random){
    let buffer = Buffer.alloc(w * h * NUM_CHANNELS)

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let idx = (w * y + x) * NUM_CHANNELS;
            buffer[idx] = random.randomUInt(0, 256);
            buffer[idx + 1] = random.randomUInt(0, 256);
            buffer[idx + 2] = random.randomUInt(0, 256);
        }
    }

    return buffer;
}

function generateShades(w, h, random){
    let buffer = Buffer.alloc(w * h * NUM_CHANNELS)
    const variationIdx = random.randomUInt(0, 7);
    const v = [
        [1, 0, 0], [0, 1, 0], [0, 0, 1],
        [1, 1, 0], [1, 0, 1], [0, 1, 1],
        [1, 1, 1]
    ][variationIdx];

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (w * y + x) * NUM_CHANNELS;
            const a = random.randomUInt(0, 256);
            const b = random.randomUInt(0, a);
            buffer[idx] = v[0] * a + (1 - v[0]) * b;
            buffer[idx + 1] = v[1] * a + (1 - v[1]) * b;
            buffer[idx + 2] = v[2] * a + (1 - v[2]) * b;
        }
    }

    return buffer;
}

function softmax(logits) {
    const maxLogit = Math.max(...logits);
    const scores = logits.map(l => Math.exp(l - maxLogit));
    const denom = scores.reduce((a, b) => a + b);
    return scores.map(s => s / denom);
}

function getGradientCoeffs(x, y, bases, maxDist) {
    return softmax(bases.map(b => Math.E * Math.PI * (1 - dist(x, y, b.x, b.y) / maxDist)));
}

function getOverflowCoeffs(x, y, bases, maxDist) {
    return bases.map(b => Math.log(Math.E * Math.PI * (1 - dist(x, y, b.x, b.y) / maxDist)));
}

function generateWithCoeffs(w, h, random, getCoeffs, numColors) {
    let buffer = Buffer.alloc(w * h * NUM_CHANNELS)

    let bases = [];
    let colors = [];

    for (let i = 0; i < numColors; i++) {
        bases.push({
            x: random.randomUInt(0, w),
            y: random.randomUInt(0, h)
        })

        colors.push({
            r: random.randomUInt(0, 256),
            g: random.randomUInt(0, 256),
            b: random.randomUInt(0, 256),
        })
    }

    const maxDist = Math.sqrt(w ** 2 + h ** 2);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let idx = (w * y + x) * NUM_CHANNELS;
            const coeffs = getCoeffs(x, y, bases, maxDist);

            buffer[idx] = colors.reduce((acc, c, i) => acc + c.r * coeffs[i], 0);
            buffer[idx + 1] = colors.reduce((acc, c, i) => acc + c.g * coeffs[i], 0);
            buffer[idx + 2] = colors.reduce((acc, c, i) => acc + c.b * coeffs[i], 0);
        }
    }

    return buffer;
}

function generateGradient(w, h, random, numColors){
    return generateWithCoeffs(w, h, random, getGradientCoeffs, numColors);
}

function generateOverflow(w, h, random, numColors){
    return generateWithCoeffs(w, h, random, getOverflowCoeffs, numColors);
}

function dist(x0, y0, x1, y1) {
    return Math.sqrt((x0 - x1) ** 2 + (y0 - y1) ** 2)
}

function distL1(x0, y0, x1, y1){
    return Math.sqrt((x0 - x1) ** 2) + Math.sqrt((y0 - y1) ** 2)
}

function distL0(x0, y0, x1, y1){
    return Math.min(Math.sqrt((x0 - x1) ** 2), Math.sqrt((y0 - y1) ** 2))
}

function corrupt(buffer, w, h, random, clean){
    const numPoints = random.randomUInt(0, 3);
    let points = [];
    let dists = [];
    for (let i = 0; i < numPoints; i++){
        points.push({
            x: random.randomUInt(0, w),
            y: random.randomUInt(0, h)
        })
        dists.push(random.randomUInt(1, w/4));
    }

    const maxVar = (clean == 1) ? 2 : 4;
    const variation = random.randomUInt(0, maxVar);

    let distFunction;
    const distVariation = random.randomUInt(0, 3);

    if (distVariation == 0) distFunction = distL0;
    if (distVariation == 1) distFunction = distL1;
    if (distVariation == 2) distFunction = dist;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let idx = (w * y + x) * 3;

            for (let i = 0; i < numPoints; i++){
                const dist = distFunction(x, y, points[i].x, points[i].y);
                if (dist <= dists[i]){

                    if (variation == 0) {
                        buffer[idx] = 255 - buffer[idx];
                        buffer[idx + 1] = 255 - buffer[idx + 1];
                        buffer[idx + 2] = 255 - buffer[idx + 2];

                    } else if (variation == 1) {
                        let tmp = buffer[idx]
                        buffer[idx] = buffer[idx + 1];
                        buffer[idx + 1] = buffer[idx + 2];
                        buffer[idx + 2] = tmp;

                    } else if (variation == 2) {
                        const coeff = 1 - dist/dists[i];
                        buffer[idx] = coeff * random.randomUInt(0, 256) + (1 - coeff) * buffer[idx];
                        buffer[idx + 1] = coeff * random.randomUInt(0, 256) + (1 - coeff) * buffer[idx + 1];
                        buffer[idx + 2] = coeff * random.randomUInt(0, 256) + (1 - coeff) * buffer[idx + 2];

                    } else if (variation == 3) {
                        buffer[idx] = random.randomUInt(0, 256);
                        buffer[idx + 1] = random.randomUInt(0, 256);
                        buffer[idx + 2] = random.randomUInt(0, 256);
                    }
                }
            }

        }
    }

    return buffer
}

function generateSymmetrical(w, h, random, symmetryDepth, numColors, clean){
    let tileBuffer = null;
    if (symmetryDepth > 1){
        tileBuffer = generateSymmetrical(w/2, h/2, random, symmetryDepth - 1, numColors, clean)
        if (random.randomUInt(0,2) == 1) tileBuffer = corrupt(tileBuffer, w/2, h/2, random, clean);
    } else {
        const variation = random.randomUInt(0, 2);
        if (variation == 0) tileBuffer = generateGradient(w/2, h/2, random, numColors);
        if (variation == 1) tileBuffer = generateOverflow(w/2, h/2, random, numColors);
    }
    let buffer = Buffer.alloc(w * h * NUM_CHANNELS);

    for (let y = 0; y < h/2; y++) {
        for (let x = 0; x < w/2; x++) {
            let tileIdx = (w/2 * y + x) * NUM_CHANNELS;

            let idx0 = (w * y + x) * NUM_CHANNELS;
            let idx1 = (w * y + w - x - 1) * NUM_CHANNELS;
            let idx2 = (w * (h - y - 1) + x) * NUM_CHANNELS;
            let idx3 = (w * (h - y - 1) + w - x - 1) * NUM_CHANNELS;

            buffer[idx0] = tileBuffer[tileIdx];
            buffer[idx0 + 1] = tileBuffer[tileIdx + 1];
            buffer[idx0 + 2] = tileBuffer[tileIdx + 2];

            buffer[idx1] = tileBuffer[tileIdx];
            buffer[idx1 + 1] = tileBuffer[tileIdx + 1];
            buffer[idx1 + 2] = tileBuffer[tileIdx + 2];

            buffer[idx2] = tileBuffer[tileIdx];
            buffer[idx2 + 1] = tileBuffer[tileIdx + 1];
            buffer[idx2 + 2] = tileBuffer[tileIdx + 2];

            buffer[idx3] = tileBuffer[tileIdx];
            buffer[idx3 + 1] = tileBuffer[tileIdx + 1];
            buffer[idx3 + 2] = tileBuffer[tileIdx + 2];
        }
    }

    return corrupt(buffer, w, h, random, clean);
}

function generateImage(number, seed, userInputs) {
    let { sizeIdx, numColors, symmetryDepth, clean, tip } = userInputs;
    const random = new Random(seed);
    const sizes = [[1, 1], [1, 8], [8, 1], [8, 8], [16, 16], [32, 32], [64, 64], [128, 128], [256, 256], [512, 512], [1024, 1024]];

    if (typeof sizeIdx === "undefined"){
        let minSizeIdx = Math.log2(number/4) << 0;
        let maxSizeIdx = Math.log2(number/4) + 2 << 0;

        if (minSizeIdx >= sizes.length) minSizeIdx = sizes.length - 1;
        if (maxSizeIdx >= sizes.length) maxSizeIdx = sizes.length - 1;

        sizeIdx = random.randomUInt(minSizeIdx, maxSizeIdx + 1);
    }

    if (sizeIdx >= sizes.length) sizeIdx = sizes.length - 1;

    const [w, h] = sizes[sizeIdx];

    if (typeof numColors === "undefined"){
        const colorNums = [2, 3, 4, 8, 16];
        const numColorsIdx = random.randomUInt(0, colorNums.length);
        numColors = colorNums[numColorsIdx];
    }

    if (typeof symmetryDepth === "undefined"){
        symmetryDepth = random.randomUInt(1, Math.log2(w) + 1);
    }

    if (symmetryDepth > Math.log2(w)) symmetryDepth = Math.log2(w);

    let buffer = null;
    if (typeof clean !== "undefined" && clean == 1 && w == h){
        buffer = generateSymmetrical(w, h, random, symmetryDepth, numColors, clean)

    } else if (w <= 8 && h <= 8) {
        const variation = random.randomUInt(0, 2);
        if (variation == 0) buffer = generateRandom(w, h, random);
        if (variation == 1) buffer = generateShades(w, h, random);

    } else if (w <= 16 && h <= 16) {
        const variation = random.randomUInt(0, 4);
        if (variation == 0) buffer = generateRandom(w, h, random);
        if (variation == 1) buffer = generateShades(w, h, random);
        if (variation == 2) buffer = generateGradient(w, h, random, numColors);
        if (variation == 3) buffer = generateOverflow(w, h, random, numColors);

    } else if (w <= 32 && h <= 32) {
        const variation = random.randomUInt(0, 3);
        if (variation == 0) buffer = generateGradient(w, h, random, numColors);
        if (variation == 1) buffer = generateOverflow(w, h, random, numColors);
        if (variation == 2) buffer = generateSymmetrical(w, h, random, symmetryDepth, numColors, clean);

    } else {
        buffer = generateSymmetrical(w, h, random, symmetryDepth, numColors, clean);
    }

    let png = encode({
        width: w,
        height: h,
        data: buffer,
        depth: 8,
        channels: NUM_CHANNELS
    })

    const pngBuffer = Buffer.from(png);
    return pngBuffer
};

// Copyright (c) 2006,2007 Mutsuo Saito, Makoto Matsumoto and Hiroshima
// University.
// Copyright (c) 2012 Mutsuo Saito, Makoto Matsumoto, Hiroshima University
// and The University of Tokyo.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the names of Hiroshima University, The University of
//       Tokyo nor the names of its contributors may be used to endorse
//       or promote products derived from this software without specific
//       prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

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
