
const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');
const cors = require('cors');
const express = require('express');
const app = express();
const port = 5000;

app.use(cors({
    origin: 'http://localhost:5000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'basic');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

const cryptoPath = envOrDefault(
    'CRYPTO_PATH',
    path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'test-network',
        'organizations',
        'peerOrganizations',
        'org1.example.com'
    )
);

const keyDirectoryPath = envOrDefault(
    'KEY_DIRECTORY_PATH',
    path.resolve(
        cryptoPath,
        'users',
        'User1@org1.example.com',
        'msp',
        'keystore'
    )
);

const certDirectoryPath = envOrDefault(
    'CERT_DIRECTORY_PATH',
    path.resolve(
        cryptoPath,
        'users',
        'User1@org1.example.com',
        'msp',
        'signcerts'
    )
);

const tlsCertPath = envOrDefault(
    'TLS_CERT_PATH',
    path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt')
);

const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const utf8Decoder = new TextDecoder();
let gateway;
let contract;

async function initializeFabric() {
    const client = await newGrpcConnection();
    gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        hash: hash.sha256,
        evaluateOptions: () => ({ deadline: Date.now() + 10000 }), 
        endorseOptions: () => ({ deadline: Date.now() + 20000 }), 
        submitOptions: () => ({ deadline: Date.now() + 10000 }), 
        commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
    });

    const network = gateway.getNetwork(channelName);
    contract = network.getContract(chaincodeName);
}


app.post('/ledger/init', async (req, res) => {
    try {
        await contract.submitTransaction('InitLedger');
        res.json({ message: 'Ledger has initialized successfully' });
    } catch (error) {
        console.error('Error initializing ledger:', error);
        res.status(500).json({ error: 'Failed to the initialize ledger you can refer aslammoinuddin4@gmail.com', details: error.message });
    }
});

app.get('/assets', async (req, res) => {
    try {
        const resultBytes = await contract.evaluateTransaction('GetAllAssets');
        const result = JSON.parse(utf8Decoder.decode(resultBytes));
        res.json(result);
    } catch (error) {
        console.error('Error fetching assets:', error);
        res.status(500).json({ error: 'Failed to retrieve assets  you can refer aslammoinuddin4@gmail.com', details: error.message });
    }
});

app.post('/asset', async (req, res) => {
    const { id, dealerId, msisdn, mpin, balance, status, transAmount, transType, remarks } = req.body;
    if (!id || !dealerId || !msisdn || !mpin || balance === undefined || !status) {
        return res.status(400).json({ error: 'Pls Fill the required fields' });
    }

    try {
        await contract.submitTransaction(
            'CreateAsset',
            id,
            dealerId,
            msisdn,
            mpin,
            balance,
            status,
            transAmount.toString(),
            transType,
            remarks
        );
        res.json({ message: `Asset ${id} created successfully` });
    } catch (error) {
        console.error('Error creating asset:', error);
        res.status(500).json({ error: 'Failed to create asset you can refer aslammoinuddin4@gmail.com', details: error.message });
    }
});

app.put('/asset', async (req, res) => {
    const { id, dealerId, msisdn, mpin, balance, status, transAmount, transType, remarks } = req.body;
    if (!id || !dealerId || !msisdn || !mpin || balance === undefined || !status) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        await contract.submitTransaction(
            'UpdateAsset',
            id,
            dealerId,
            msisdn,
            mpin,
            balance.toString(),
            status,
            transAmount.toString(),
            transType,
            remarks
        );
        res.json({ message: `Asset ${id} updated successfully` });
    } catch (error) {
        console.error('Error updating asset:', error);
        res.status(500).json({ error: 'Failed to update asset you can refer aslammoinuddin4@gmail.com', details: error.message });
    }
});

app.post('/asset/transfer', async (req, res) => {
    const { id, newOwner } = req.body;
    try {
        const oldOwner = await contract.submitTransaction('TransferAsset', id, newOwner);
  res.json({ message: `Successfully transferred the asset ${id} from ${oldOwner} to ${newOwner}` });
    } catch (error) {
     console.error('Error transferring asset:', error);
        res.status(500).json({ error: 'Failed to transfer asset you can refer aslammoinuddin4@gmail.com' });
    }
});

app.get('/asset/:id', async (req, res) => {
    const { id } = req.params;
    try {
   const resultBytes = await contract.evaluateTransaction('ReadAsset', id);
  const result = JSON.parse(utf8Decoder.decode(resultBytes));
        res.json(result);
    } catch (error) {
  console.error('Error reading asset:', error);
        res.status(500).json({ error: 'Failed to read asset you can refer aslammoinuddin4@gmail.com', details: error.message });
    }
});

app.get('/asset/:id/history', async (req, res) => {
    const { id } = req.params;
    try {
    const resultBytes = await contract.evaluateTransaction('GetAssetTransactionHistory', id);
      const result = JSON.parse(utf8Decoder.decode(resultBytes));
        res.json(result);
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({ error: 'Failed to retrieve transaction history you can refer aslammoinuddin4@gmail.com', details: error.message });
    }
});

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

async function newIdentity() {
    const certPath = await getFirstDirFileName(certDirectoryPath);
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function newSigner() {
    const keyPath = await getFirstDirFileName(keyDirectoryPath);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

async function getFirstDirFileName(dirPath) {
    const files = await fs.readdir(dirPath);
    const file = files[0];
    if (!file) {
      throw new Error(`No files in directory: ${dirPath}`);
    }
    return path.join(dirPath, file);
}

function envOrDefault(key, defaultValue) {
    return process.env[key] || defaultValue;
}

app.listen(port, async () => {
    console.log(`Server running at http://localhost:${port}`);
    await initializeFabric();
});
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>API Documentation</title>
            <style>
                body {
                    font-family: 'Arial', sans-serif;
                    background-color: #f4f7fb;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                .container {
                    background-color: #ffffff;
                    max-width: 900px;
                    width: 100%;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                    padding: 40px;
                    margin: 20px;
                }
                h1 {
                    font-size: 2.5em;
                    color: #1f2937;
                    text-align: center;
                    margin-bottom: 20px;
                }
                p {
                    font-size: 1.2em;
                    color: #4b5563;
                    text-align: center;
                    margin: 20px 0;
                }
                h3 {
                    font-size: 1.8em;
                    color: #1f2937;
                    margin-bottom: 10px;
                    text-align: center;
                }
                ul {
                    list-style-type: none;
                    padding: 0;
                    font-size: 1.1em;
                }
                ul li {
                    background-color: #e5e7eb;
                    border-radius: 6px;
                    margin: 10px 0;
                    padding: 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    transition: background-color 0.3s ease-in-out;
                }
                ul li:hover {
                    background-color: #d1d5db;
                }
                .copy-btn {
                    padding: 5px 10px;
                    background-color: #2563eb;
                    color: white;
                    font-weight: bold;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.3s ease;
                }
                .copy-btn:hover {
                    background-color: #1d4ed8;
                }
                footer {
                    text-align: center;
                    margin-top: 40px;
                    font-size: 0.9em;
                    color: #6b7280;
                }
                footer a {
                    color: #2563eb;
                    text-decoration: none;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>API Documentation</h1>
                <p>Welcome to the API Server. Please use Postman or any other API client to interact with the endpoints listed below.</p>
                <h3>Available Endpoints:</h3>
                <ul>
                    <li>
                        <span>POST /ledger/init</span>
                        <button class="copy-btn" onclick="copyToClipboard('/ledger/init')">Copy URL</button>
                    </li>
                    <li>
                        <span>GET /assets</span>
                        <button class="copy-btn" onclick="copyToClipboard('/assets')">Copy URL</button>
                    </li>
                    <li>
                        <span>POST /asset</span>
                        <button class="copy-btn" onclick="copyToClipboard('/asset')">Copy URL</button>
                    </li>
                    <li>
                        <span>PUT /asset</span>
                        <button class="copy-btn" onclick="copyToClipboard('/asset')">Copy URL</button>
                    </li>
                    <li>
                        <span>POST /asset/transfer</span>
                        <button class="copy-btn" onclick="copyToClipboard('/asset/transfer')">Copy URL</button>
                    </li>
                    <li>
                        <span>GET /asset/:id</span>
                        <button class="copy-btn" onclick="copyToClipboard('/asset/:id')">Copy URL</button>
                    </li>
                    <li>
                        <span>GET /asset/:id/history</span>
                        <button class="copy-btn" onclick="copyToClipboard('/asset/:id/history')">Copy URL</button>
                    </li>
                </ul>
                <footer>
                    <p>For assistance, please contact <a href="mailto:aslammoinuddin4@gmail.com">aslammoinuddin4@gmail.com</a></p>
                </footer>
            </div>
            <script>
                function copyToClipboard(text) {
                    navigator.clipboard.writeText(text).then(() => {
                        alert('URL copied to clipboard!');
                    }).catch(err => {
                        alert('Failed to copy URL');
                    });
                }
            </script>
        </body>
        </html>
    `);
});
