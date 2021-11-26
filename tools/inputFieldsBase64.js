let params = [
    {
        "name": "stage",
        "type": "string",
        "description": "This is a 2 stage txFunction. The stages are 'issueTicket' and 'generateNFT'",
        "rule": "Required"
    },
    {
        "name": "source",
        "type": "string",
        "description": "Public key of the source account.",
        "rule": "Required"
    },
    {
        "name": "sizeIdx",
        "type": "number",
        "description": "Defines the size. It's an index into the predefined sizes array.",
        "rule": "Optional"
    },
    {
        "name": "numColors",
        "type": "number",
        "description": "Number of base colors.",
        "rule": "Optional"
    },
    {
        "name": "symmetryDepth",
        "type": "number",
        "description": "Number of reccurent calls to build a symmetrical image.",
        "rule": "Optional"
    },
    {
        "name": "clean",
        "type": "boolean",
        "description": "Avoid noise corruptions.",
        "rule": "Optional"
    },
    {
        "name": "tip",
        "type": "number",
        "description": "Tip :)",
        "rule": "Optional"
    },
    {
        "name": "hostIpfs",
        "type": "string",
        "description": "Ipfs host.",
        "rule": "Optional"
    },
    {
        "name": "authIpfs",
        "type": "string",
        "description": "Ipfs authentication.",
        "rule": "Optional"
    },
    {
        "name": "ticketTxHash",
        "type": "string",
        "description": "Hash of the submited transaction created at the ticket stage.",
        "rule": "Optional"
    },
    {
        "name": "seed",
        "type": "string",
        "description": "Seed for the NFT issuer account.",
        "rule": "Optional"
    }
]

const base64 = Buffer.from(JSON.stringify(params)).toString('base64');
console.log("txFunctionFields:", base64);
