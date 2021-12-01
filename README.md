# RandomPixels

Create a randomly generated image NFT.

This is a POC and should provide a base for a framework to generate files, store them on IPFS and issue them as NFTs when running a `txFunction` on `stellar-turrets`.

*If the concept proves to be achievable it will make it easy to create **generative art NFT collections**. The random aspect might be useful for **games**. E.g. generate a rare item with random properties in a decentralized and transparent way and adjust the corresponding artwork depending on the item's properties. Maybe even generate invoices or contracts. Anyway, I think it would be useful to have a way of issuing an NFT linked to an automatically created file.*

## How does it work?

This contract has 2 parts: `issueTicket` and `generateNFT`

It can't be achieved in a single step because when a txFunction is run, the resulting XDR doesn't have to be submitted to the network, therefore a commitment is required before the file and the NFT are created.

#### 1. `issueTicket`

Firstly, a user acquires a ticket to generate an NFT. If this XDR is not submitted nobody cares. Only the user loses a tiny amount for running the txFunction. If the user decides to submit the signed XDR, he pays whatever he needs to and gets the right to run the second part of this contract.

#### 2. `generateNFT`

After receiving a ticket, the user can run the second part, which generates the file, uploads it to IPFS, issues the NFT and sends it to the user. If he decides to not run the second part, it's only his loss, because he's already paid for it. If he decides to run it, but not submit the XDR, the file would get generated and stored to IPFS, but the NFT is not issued, which is still ok - everything is paid for by the user beforehand. Running the generation on multiple turrets will assure that each of them creates the same file, because if a different file is created, then IPFS would return a different hash and that would change the final XDR.


## 
To run this you will need an IPFS node (Infura provides this for free up to a limit).

```
rollup -c  
node index.js
```
