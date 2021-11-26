let params = [
    {
        "name": "stage",
        "type": "string",
        "description": "",
        "rule": "Required"
    },
    {
        "name": "source",
        "type": "string",
        "description": "",
        "rule": "Required"
    },
    {
        "name": "sizeIdx",
        "type": "number",
        "description": "",
        "rule": "Optional"
    },
    {
        "name": "numColors",
        "type": "number",
        "description": "",
        "rule": "Optional"
    },
    {
        "name": "symmetryDepth",
        "type": "number",
        "description": "",
        "rule": "Optional"
    },
    {
        "name": "clean",
        "type": "boolean",
        "description": "",
        "rule": "Optional"
    },
    {
        "name": "tip",
        "type": "number",
        "description": "",
        "rule": "Optional"
    },
    {
        "name": "hostIpfs",
        "type": "string",
        "description": "",
        "rule": "Optional"
    },
    {
        "name": "authIpfs",
        "type": "string",
        "description": "",
        "rule": "Optional"
    },
    {
        "name": "ticketTxHash",
        "type": "string",
        "description": "",
        "rule": "Optional"
    },
    {
        "name": "seed",
        "type": "string",
        "description": "",
        "rule": "Optional"
    }
]

const base64 = Buffer.from(JSON.stringify(params)).toString('base64');
console.log("txFunctionFields:", base64);
