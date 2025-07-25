const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const API_KEY = 'heheysports';

const CONFIG = {
    DATA_FILE: path.join(__dirname, 'bot_data.json'),
};

let availableKeys = [];
let usedKeys = [];

class DataManager {
    constructor() {
        this.data = {
            users: {},
            scripts: {},
            protected_scripts: {},
            settings: {
                created_at: new Date().toISOString(),
                version: '2.0.3'
            }
        };
        this.loadData();
    }

    loadData() {
        try {
            if (fs.existsSync(CONFIG.DATA_FILE)) {
                const fileData = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
                this.data = { ...this.data, ...fileData };
                console.log('✅ Data loaded successfully');
            }
        } catch (error) {
            console.error('❌ Error loading data:', error);
        }
    }

    saveData() {
        try {
            fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(this.data, null, 2));
            console.log('💾 Data saved successfully');
        } catch (error) {
            console.error('❌ Error saving data:', error);
        }
    }

    generateScriptKey() {
        return crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substr(0, 32);
    }

    xorString(str, key) {
        let result = '';
        for (let i = 0; i < str.length; i++) {
            result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    }

    obfuscateScript(content, scriptKey) {
        // Layer 1: Base64 encode with salt
        const salt1 = crypto.randomBytes(8).toString('hex');
        const saltedContent = salt1 + content;
        let encoded = Buffer.from(saltedContent).toString('base64');

        // Layer 2: Second Base64 encode with another salt
        const salt2 = crypto.randomBytes(8).toString('hex');
        encoded = Buffer.from(salt2 + encoded).toString('base64');

        // Layer 3: XOR encryption
        const xored = this.xorString(encoded, scriptKey);

        // Convert XOR result to hex for safe storage
        const hexEncoded = Buffer.from(xored).toString('hex');

        // Junk code and control flow obfuscation
        const junkCode = `-- Obfuscation layer\nlocal _${Math.random().toString(36).substring(2, 10)} = ${Math.random()};\n`.repeat(5);
        const dummyFunction = `local function _dummy_${Math.random().toString(36).substring(2, 10)}(x)\n    local _ = math.random(); return x * _;\nend\n`;

        const obfuscated = `-- Protected by ScriptGuard Pro\n-- Script Key: ${scriptKey}\n${junkCode}${dummyFunction}
local function xorString(str, key)
    local result = ""
    for i = 1, #str do
        result = result .. string.char(string.byte(str, i) ~ string.byte(key, (i - 1) % #key + 1))
    end
    return result
end
local function decodeBase64(str)
    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    str = string.gsub(str, '[^'..b..'=]', '')
    return (str:gsub('.', function(x)
        if x == '=' then return '' end
        local r,f='',(b:find(x)-1)
        for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
        return r
    end):gsub('%d%d%d%d%d%d%d%d', function(x)
        if (#x ~= 8) then return '' end
        local c=0
        for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
        return string.char(c)
    end))
end
local function hexToString(hex)
    local str = ""
    for i=1,#hex,2 do
        str = str .. string.char(tonumber(hex:sub(i,i+1),16))
    end
    return str
end
local scriptKey = "${scriptKey}"
local protectedContent = "${hexEncoded}"
local salt1Length = ${salt1.length}
local salt2Length = ${salt2.length}
if not scriptKey or scriptKey == "" then
    error("Invalid script key")
end
local success, result = pcall(function()
    local xored = hexToString(protectedContent)
    local decoded = xorString(xored, scriptKey)
    decoded = decodeBase64(decoded)
    decoded = decodeBase64(decoded:sub(salt2Length + 1))
    decoded = decoded:sub(salt1Length + 1)
    return loadstring(decoded)()
end)
if not success then
    error("Failed to load protected script: " .. tostring(result))
end`;
        return obfuscated;
    }

    deobfuscateScript(protectedContent, scriptKey) {
        return `-- ScriptGuard Pro Deobfuscator\nlocal scriptKey = "${scriptKey}"\n${protectedContent}`;
    }

    getScript(scriptName) {
        if (!scriptName) return null;
        const normalizedName = scriptName.trim().toLowerCase();
        return this.data.protected_scripts[normalizedName] || null;
    }

    createScript(scriptName, scriptContent, createdBy) {
        const normalizedName = scriptName.trim().toLowerCase();
        const displayName = scriptName.trim();
        const scriptKey = this.generateScriptKey();
        const protectedContent = this.obfuscateScript(scriptContent, scriptKey);

        this.data.scripts[normalizedName] = {
            display_name: displayName,
            created_by: createdBy,
            created_at: new Date().toISOString(),
            protected: true,
            script_key: scriptKey,
            user_count: 0
        };

        this.data.protected_scripts[normalizedName] = {
            display_name: displayName,
            original_content: scriptContent,
            protected_content: protectedContent,
            script_key: scriptKey,
            file_size: Buffer.byteLength(scriptContent, 'utf8')
        };

        this.saveData();
        return { scriptKey, protectedContent, normalizedName };
    }
}

const dataManager = new DataManager();

function isExecutorRequest(req) {
    const userAgent = req.headers['user-agent'] || '';
    const acceptHeader = req.headers['accept'] || '';
    const referer = req.headers['referer'] || '';

    if (acceptHeader.includes('text/html')) return false;
    if (referer && (referer.startsWith('http://') || referer.startsWith('https://'))) return false;

    const strictBrowserPatterns = [
        /mozilla.*firefox/i,
        /mozilla.*chrome/i,
        /mozilla.*safari/i,
        /mozilla.*edge/i,
        /mozilla.*opera/i
    ];

    if (strictBrowserPatterns.some(pattern => pattern.test(userAgent))) return false;

    const executorPatterns = [
        /synapse/i,
        /krnl/i,
        /fluxus/i,
        /script-ware/i,
        /oxygen/i,
        /sentinel/i,
        /protosmasher/i,
        /sirhurt/i,
        /jjsploit/i,
        /exploits/i,
        /executor/i,
        /roblox.*exploit/i,
        /lua.*executor/i,
        /roblox/i
    ];

    if (executorPatterns.some(pattern => pattern.test(userAgent))) return true;
    if (!userAgent || userAgent.trim() === '' || userAgent.length < 20) return true;
    if (!acceptHeader.includes('text/html') && !acceptHeader.includes('application/xhtml')) return true;
    return true;
}

app.use(express.static(path.join(__dirname, 'public')));

app.post('/refill-keys', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }

    const { keys } = req.body;
    if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(400).json({ error: 'Invalid or empty keys array' });
    }

    // Add keys to availableKeys (this mimics the client-side refillKeys function)
    availableKeys = [...availableKeys, ...keys];
    console.log(`Keys refilled: ${keys.length} new keys added`);
    res.json({ success: true, message: `${keys.length} keys added`, totalKeys: availableKeys.length });
});


app.post('/upload-script', (req, res) => {
    const { scriptName, scriptContent, createdBy } = req.body;

    if (!scriptName || !scriptContent || !createdBy) {
        return res.status(400).send('Missing required fields');
    }

    const { normalizedName, scriptKey, protectedContent } = dataManager.createScript(scriptName, scriptContent, createdBy);
    res.status(200).json({ normalizedName, scriptKey });
});

app.get('/loadstring', (req, res) => {
    if (!isExecutorRequest(req)) {
        return res.status(403).send('-- Error: Direct access to loadstring is not authorized. Use an executor.');
    }

    const { script } = req.query;

    if (!script) {
        return res.status(400).send('-- Error: Script parameter is required');
    }

    const scriptData = dataManager.getScript(script);

    if (!scriptData) {
        return res.status(404).send('-- Error: Script not found');
    }

    console.log(`🔓 Executor access granted for script: ${script}`);
    console.log(`📱 User-Agent: ${req.headers['user-agent']}`);

    if (dataManager.data.scripts[script.toLowerCase()]) {
        dataManager.data.scripts[script.toLowerCase()].user_count++;
        dataManager.saveData();
    }

    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(dataManager.deobfuscateScript(scriptData.protected_content, scriptData.script_key));
});
app.get('/key-count', (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    }

    res.json({
        available: availableKeys.length,
        used: usedKeys.length,
        total: availableKeys.length + usedKeys.length
    });
});
app.get('/scripts', (req, res) => {
    res.status(403).send('Access to scripts is restricted.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
});