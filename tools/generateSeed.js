const { Keypair } = require('stellar-sdk');
console.log(Keypair.random().publicKey())
