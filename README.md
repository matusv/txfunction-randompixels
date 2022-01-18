# RandomPixels

Create randomly generated image NFTs.

This concept might get reused for any file type.

## How does it work?

This contract has 2 parts: `issueTicket` and `generateNFT`

It can't be achieved in a single step because when a txFunction is run, the resulting XDR doesn't have to be submitted to the network, therefore a commitment is required before the file and the NFT are created.

#### 1. `issueTicket`

Firstly, a user acquires a ticket to generate an NFT. If this XDR is not submitted nobody cares. Only the user loses a tiny amount for running the txFunction. If the user decides to submit the signed XDR, he pays whatever he needs to and gets the right to run the second part of this contract.

#### 2. `generateNFT`

After receiving a ticket, the user can run the second part, which generates the file, uploads it to IPFS, issues the NFT and sends it to the user. If he decides to not run the second part, it's only his loss, because he's already paid for it. If he decides to run it, but not submit the XDR, the file would get generated and stored to IPFS, but the NFT is not issued, which is still ok - everything is paid for by the user beforehand. Running the generation on multiple turrets will assure that each of them creates the same file, because if a different file is created, then IPFS would return a different hash and that would change the final XDR.

## Randomness

Randomness is achieved by using the ticket transaction hash as a seed for a pseudorandom number generator in the second part. Potential problem with this is that the user might check what this seed produces before he actually submits the transaction. Again, it's paid for, so in this setting it's not much of a problem.

## Random Image Generator

There are several parameters the generator is rolling for:
### 1. Size
Possible values: `[1, 1]`, `[1, 8]`, `[8, 1]`, `[8, 8]`, `[16, 16]`, `[32, 32]`, `[64, 64]`, `[128, 128]`.  
The chance of getting bigger sizes increases with the number of issued nfts.

### 2. Generation Technique
- Random - completely random pixels.
- Shades - random shades of a color. Possible colors: red, green, blue, cyan, magenta, yellow, black.
- Gradient - gradient of n colors with random base positions.
- Overflow - similar to gradient with a little twist which produces interesting images
- Symmetrical - recursively creates an image by rotating a tile 4 times. At the root of the recurrency one of the previous generation techniques is chosen randomly to generate the tile. CoThe recurrency depth is chosen randomly as well. At each recurrent step a `corruption` might happen. Corruption means adding noise or shifting colors of a certain area in the image.


The size affects which generation techniques are being rolled for.
- smaller than 8x8: random, shades
- 8x8 - 16x16: random, shades, gradient, overflow
- 16x16 - 32x32: gradient, overflow, symmetrical
- bigger than 32x32: symmetrical

### 3. Number of colors
Relevant in gradient, overflow and symmetrical generation techniques.

### 4. Symmetry Depth
Relevant in symmetrical generation technique.

## User inputs
- size
- number of colors
- symmetry depth
- clean - this will disable the chance to get noise in corruption.
- tip - if you want to show some ❤️ you can leave a tip.

## 
To run this you will need an IPFS node (Infura provides this for free up to a limit). I also provide an IPFS authentication token in the code with a small limit.

```
rollup --config testnet.config.js  
node index.js
```
