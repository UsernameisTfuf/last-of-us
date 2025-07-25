require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    AttachmentBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fetch = require('node-fetch');
const token = process.env.DISCORD_TOKEN;


const CONFIG = {

    CLIENT_ID: '1395038151562498199',
    GUILD_ID: '1393970952819183726',
    DATA_FILE: path.join(__dirname, 'bot_data.json'),
    ADMIN_ROLE: 'Administrator',
    WEBSITE_URL: 'http://localhost:3000',
    API_KEY: 'heheysports'
};

class DataManager {
    constructor() {
        this.data = {
            users: {},
            scripts: {},
            protected_scripts: {},
            license_keys: [],
            settings: {
                created_at: new Date().toISOString(),
                version: '2.0.4'
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

    createUser(userId, scriptName, licenseKey) {
        if (!this.data.users[userId]) {
            this.data.users[userId] = {};
        }

        this.data.users[userId][scriptName] = {
            license_key: licenseKey,
            hwid: this.generateHWID(),
            whitelisted: true,
            created_at: new Date().toISOString(),
            last_reset: null,
            access_count: 0
        };

        this.saveData();
        return this.data.users[userId][scriptName];
    }

    getUserAccess(userId, scriptName = null) {
        if (!this.data.users[userId]) return null;

        if (scriptName) {
            return this.data.users[userId][scriptName] || null;
        }

        return this.data.users[userId];
    }

    resetUserHWID(userId, scriptName = null) {
        if (!this.data.users[userId]) return false;

        if (scriptName) {
            if (this.data.users[userId][scriptName]) {
                this.data.users[userId][scriptName].hwid = this.generateHWID();
                this.data.users[userId][scriptName].last_reset = new Date().toISOString();
                this.saveData();
                return true;
            }
        } else {
            for (const script in this.data.users[userId]) {
                this.data.users[userId][script].hwid = this.generateHWID();
                this.data.users[userId][script].last_reset = new Date().toISOString();
            }
            this.saveData();
            return true;
        }

        return false;
    }

    generateHWID() {
        return crypto.randomBytes(8).toString('hex').toUpperCase();
    }

    generateScriptKey() {
        return crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substr(0, 32);
    }

    generateLicenseKey() {
        return crypto.randomBytes(8).toString('hex').toUpperCase().match(/.{1,4}/g).join('-');
    }

    xorString(str, key) {
        let result = '';
        for (let i = 0; i < str.length; i++) {
            result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
        }
        return result;
    }

    obfuscateScript(content, scriptKey) {
        const salt1 = crypto.randomBytes(8).toString('hex');
        const saltedContent = salt1 + content;
        let encoded = Buffer.from(saltedContent).toString('base64');

        const salt2 = crypto.randomBytes(8).toString('hex');
        encoded = Buffer.from(salt2 + encoded).toString('base64');

        const xored = this.xorString(encoded, scriptKey);
        const hexEncoded = Buffer.from(xored).toString('hex');

        const junkCode = `-- Obfuscation layer\nlocal _${Math.random().toString(36).substring(2, 10)} = ${Math.random()};\n`.repeat(5);
        const dummyFunction = `local function _dummy_${Math.random().toString(36).substring(2, 10)}(x)\n    local _ = math.random(); return x * _;\nend\n`;
        const fakeControl = `if math.random() > 1 then _dummy_${Math.random().toString(36).substring(2, 10)}(0) end\n`;

        const obfuscated = `-- Protected by CaseOH Guards\n-- Script Key: ${scriptKey}\n${junkCode}${dummyFunction}${fakeControl}
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

    getScript(scriptName) {
        if (!scriptName) return null;
        const normalizedName = scriptName.trim().toLowerCase();
        return this.data.protected_scripts[normalizedName] || null;
    }

    scriptExists(scriptName) {
        if (!scriptName) return false;
        const normalizedName = scriptName.trim().toLowerCase();
        return this.data.scripts.hasOwnProperty(normalizedName);
    }

    getAllScripts() {
        return Object.keys(this.data.scripts);
    }

    getScriptDisplayName(scriptName) {
        if (!scriptName) return null;
        const normalizedName = scriptName.trim().toLowerCase();
        return this.data.scripts[normalizedName]?.display_name || null;
    }

    redeemKey(userId, scriptName, licenseKey) {
        if (!this.data.users[userId]) {
            this.data.users[userId] = {};
        }

        const normalizedName = scriptName.trim().toLowerCase();
        if (!this.data.scripts[normalizedName]) return false;

        if (!this.data.license_keys.includes(licenseKey)) return false;

        const keyIndex = this.data.license_keys.indexOf(licenseKey);
        if (keyIndex !== -1) {
            this.data.license_keys.splice(keyIndex, 1);
            this.saveData();
        }

        this.data.users[userId][normalizedName] = {
            license_key: licenseKey,
            hwid: this.generateHWID(),
            whitelisted: true,
            created_at: new Date().toISOString(),
            last_reset: null,
            access_count: 0
        };

        this.saveData();
        return true;
    }

    generateKeys(amount) {
        const keys = [];
        for (let i = 0; i < amount; i++) {
            const key = this.generateLicenseKey();
            keys.push(key);
            this.data.license_keys.push(key);
        }
        this.saveData();
        return keys;
    }
}

const dataManager = new DataManager();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Whitelist a user for script access')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to whitelist')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('script')
                .setDescription('Script name')
                .setRequired(true)
                .setAutocomplete(true))
        .addStringOption(option =>
            option.setName('key')
                .setDescription('Custom license key (optional)')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('upload-script')
        .setDescription('Upload and protect a new script')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Script name')
                .setRequired(true))
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('Lua script file')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('reset-hwid')
        .setDescription('Reset HWID for a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to reset HWID for')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('script')
                .setDescription('Specific script (optional)')
                .setRequired(false)
                .setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('setpanel')
        .setDescription('Create a control panel for a script in a specific channel')
        .addStringOption(option =>
            option.setName('script')
                .setDescription('Script name')
                .setRequired(true)
                .setAutocomplete(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send the panel')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('generatekeys')
        .setDescription('Generate a specified number of license keys')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Number of keys to generate')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName('refill_keys')
        .setDescription('Refill keys for the website from a text file')
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('Text file containing license keys (one per line)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
];

const rest = new REST({ version: '10' }).setToken(token);

async function registerCommands() {
    try {
        console.log('🔄 Started refreshing slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
            { body: commands }
        );
        console.log('✅ Successfully reloaded slash commands!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

function createSuccessEmbed(title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setTitle(`✅ ${title}`)
        .setDescription(description)
        .setColor('#00FF00')
        .setTimestamp();
    if (fields.length > 0) {
        embed.addFields(fields);
    }
    return embed;
}

function createErrorEmbed(title, description) {
    return new EmbedBuilder()
        .setTitle(`❌ ${title}`)
        .setDescription(description)
        .setColor('#FF0000')
        .setTimestamp();
}

function createInfoEmbed(title, description, fields = []) {
    const embed = new EmbedBuilder()
        .setTitle(`ℹ️ ${title}`)
        .setDescription(description)
        .setColor('#0099FF')
        .setTimestamp();
    if (fields.length > 0) {
        embed.addFields(fields);
    }
    return embed;
}

function createControlPanel(scriptName) {
    const displayName = dataManager.getScriptDisplayName(scriptName) || scriptName;
    const normalizedName = scriptName.trim().toLowerCase();

    const embed = new EmbedBuilder()
        .setTitle(`🎮 ${displayName} - Control Panel`)
        .setDescription(`**Welcome to the ${displayName} control panel!**\n\nUse the buttons below to manage your access:`)
        .addFields(
            { name: '🔑 Get Script', value: 'Download your protected script file', inline: true },
            { name: '🔑 Redeem Key', value: 'Redeem a license key', inline: true },
            { name: '📊 View Stats', value: 'Check your account statistics', inline: true },
            { name: '🔄 Reset HWID', value: 'Reset your hardware ID', inline: true }
        )
        .setColor('#FFA500')
        .setTimestamp()
        .setFooter({ text: 'ScriptGuard Pro | Click buttons below' });

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`get_script_${normalizedName}`)
                .setLabel('🔑 Get Script')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`redeem_key_${normalizedName}`)
                .setLabel('🔑 Redeem Key')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`view_stats_${normalizedName}`)
                .setLabel('📊 View Stats')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId(`reset_hwid_${normalizedName}`)
                .setLabel('🔄 Reset HWID')
                .setStyle(ButtonStyle.Secondary)
        );

    return { embeds: [embed], components: [row] };
}

async function handleWhitelist(interaction) {
    try {
        const user = interaction.options.getUser('user');
        const scriptName = interaction.options.getString('script');
        const customKey = interaction.options.getString('key');

        if (!scriptName || scriptName.trim() === '') {
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid Input', 'Please provide a valid script name.')],
                ephemeral: true
            });
        }

        if (!dataManager.scriptExists(scriptName)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Script Not Found', `Script "${scriptName}" does not exist.`)],
                ephemeral: true
            });
        }

        const licenseKey = customKey || dataManager.generateLicenseKey();
        dataManager.data.license_keys.push(licenseKey);
        const normalizedName = scriptName.trim().toLowerCase();
        dataManager.createUser(user.id, normalizedName, licenseKey);

        await interaction.reply(`<@${user.id}>. You have been successfully whitelisted.`);
    } catch (error) {
        console.error('Whitelist error:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Error', 'Failed to whitelist user.')],
            ephemeral: true
        });
    }
}

async function handleUploadScript(interaction) {
    try {
        const scriptName = interaction.options.getString('name');
        const attachment = interaction.options.getAttachment('file');

        if (!scriptName || scriptName.trim() === '') {
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid Input', 'Please provide a valid script name.')],
                ephemeral: true
            });
        }

        if (!attachment.name.endsWith('.lua') && !attachment.name.endsWith('.txt')) {
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid File', 'Please upload a .lua or .txt file.')],
                ephemeral: true
            });
        }

        if (dataManager.scriptExists(scriptName)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Script Exists', `Script "${scriptName}" already exists. Please choose a different name.`)],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const response = await fetch(attachment.url);
        const scriptContent = await response.text();

        if (!scriptContent || scriptContent.trim() === '') {
            return interaction.editReply({
                embeds: [createErrorEmbed('Invalid Script', 'The script file is empty or invalid.')]
            });
        }

        const uploadResponse = await fetch(`${CONFIG.WEBSITE_URL}/upload-script`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.API_KEY
            },
            body: JSON.stringify({
                scriptName,
                scriptContent,
                createdBy: interaction.user.id
            })
        });

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload script to web server: ${uploadResponse.statusText}`);
        }

        const { normalizedName, scriptKey } = await uploadResponse.json();

        const embed = createSuccessEmbed(
            'Uploaded Successfully',
            `Script **${scriptName}** uploaded and obfuscated successfully!\n\n` +
            `**Loadstring URL:** \`${CONFIG.WEBSITE_URL}/loadstring?userId=${interaction.user.id}&scriptName=${normalizedName}\`\n` +
            `**How to Use:** Paste this URL into your executor with a script like:\n` +
            '```lua\n' +
            'local userId = "YOUR_USER_ID"\n' +
            'local scriptName = "' + normalizedName + '"\n' +
            'local url = "' + CONFIG.WEBSITE_URL + '/loadstring?userId=" .. userId .. "&scriptName=" .. scriptName\n' +
            'loadstring(game:HttpGet(url))()\n' +
            '```' +
            '\nEnsure your executor\'s User-Agent is set to a supported executor (e.g., Synapse, Krnl).'
        );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Upload error:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                embeds: [createErrorEmbed('Upload Failed', 'Failed to process and upload the script file.')]
            });
        } else {
            await interaction.reply({
                embeds: [createErrorEmbed('Upload Failed', 'Failed to process and upload the script file.')],
                ephemeral: true
            });
        }
    }
}

async function handleResetHWID(interaction) {
    try {
        const user = interaction.options.getUser('user');
        const scriptName = interaction.options.getString('script');

        if (scriptName && !dataManager.scriptExists(scriptName)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Script Not Found', `Script "${scriptName}" does not exist.`)],
                ephemeral: true
            });
        }

        const normalizedName = scriptName ? scriptName.trim().toLowerCase() : null;
        const success = dataManager.resetUserHWID(user.id, normalizedName);

        if (!success) {
            return interaction.reply({
                embeds: [createErrorEmbed('Reset Failed', 'User not found or has no script access.')],
                ephemeral: true
            });
        }

        const displayName = scriptName ? (dataManager.getScriptDisplayName(scriptName) || scriptName) : 'All Scripts';
        const embed = createSuccessEmbed(
            'HWID Reset',
            `Successfully reset HWID for **${user.username}**`,
            [
                { name: '👤 User', value: `<@${user.id}>`, inline: true },
                { name: '📜 Script', value: displayName, inline: true },
                { name: '🔄 Reset By', value: `<@${interaction.user.id}>`, inline: true }
            ]
        );

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Reset HWID error:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Error', 'Failed to reset HWID.')],
            ephemeral: true
        });
    }
}

async function handlePanel(interaction) {
    try {
        const scriptName = interaction.options.getString('script');
        const channel = interaction.options.getChannel('channel');

        if (!scriptName || scriptName.trim() === '') {
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid Input', 'Please provide a valid script name.')],
                ephemeral: true
            });
        }

        if (!dataManager.scriptExists(scriptName)) {
            return interaction.reply({
                embeds: [createErrorEmbed('Script Not Found', `Script "${scriptName}" does not exist.`)],
                ephemeral: true
            });
        }

        const normalizedName = scriptName.trim().toLowerCase();
        const panelData = createControlPanel(normalizedName);
        await channel.send(panelData);
        await interaction.reply({
            embeds: [createSuccessEmbed('Panel Created', `Control panel for **${scriptName}** sent to ${channel}.`)],
            ephemeral: true
        });
    } catch (error) {
        console.error('Panel error:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Error', 'Failed to create panel.')],
            ephemeral: true
        });
    }
}

async function handleGenerateKeys(interaction) {
    try {
        const amount = interaction.options.getInteger('amount');

        if (amount <= 0) {
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid Amount', 'Please provide a positive number of keys.')],
                ephemeral: true
            });
        }

        const keys = dataManager.generateKeys(amount);
        const embed = createSuccessEmbed(
            'Keys Generated',
            `Generated **${amount}** license keys:\n\`\`\`${keys.join('\n')}\`\`\``,
            [{ name: 'Note', value: 'These keys can be used with the /redeem key feature.', inline: false }]
        );

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        console.error('Generate keys error:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Error', 'Failed to generate keys.')],
            ephemeral: true
        });
    }
}

async function handleRefillKeys(interaction) {
    try {
        const attachment = interaction.options.getAttachment('file');

        if (!attachment.name.endsWith('.txt')) {
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid File', 'Please upload a .txt file containing license keys.')],
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const response = await fetch(attachment.url);
        const textContent = await response.text();

        if (!textContent || textContent.trim() === '') {
            return interaction.editReply({
                embeds: [createErrorEmbed('Invalid File', 'The file is empty or invalid.')]
            });
        }

        // Parse keys from the text file (one key per line)
        const keys = textContent.split('\n').map(key => key.trim()).filter(key => key.length > 0);

        if (keys.length === 0) {
            return interaction.editReply({
                embeds: [createErrorEmbed('No Keys Found', 'The file does not contain any valid keys.')]
            });
        }

        // Add keys to DataManager
        keys.forEach(key => {
            if (!dataManager.data.license_keys.includes(key)) {
                dataManager.data.license_keys.push(key);
            }
        });
        dataManager.saveData();

        // Send keys to the website
        const apiResponse = await fetch(`${CONFIG.WEBSITE_URL}/refill-keys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': CONFIG.API_KEY
            },
            body: JSON.stringify({ keys })
        });

        if (!apiResponse.ok) {
            throw new Error(`Failed to refill keys on website: ${apiResponse.statusText}`);
        }

        const { message, totalKeys } = await apiResponse.json();

        const embed = createSuccessEmbed(
            'Keys Refilled',
            `Successfully refilled **${keys.length}** keys from the uploaded file.\n${message}`,
            [
                { name: 'Total Available Keys', value: totalKeys.toString(), inline: true },
                { name: 'Uploaded By', value: `<@${interaction.user.id}>`, inline: true }
            ]
        );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Refill keys error:', error);
        if (interaction.deferred) {
            await interaction.editReply({
                embeds: [createErrorEmbed('Error', 'Failed to refill keys.')]
            });
        } else {
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'Failed to refill keys.')],
                ephemeral: true
            });
        }
    }
}

async function handleButtonInteraction(interaction) {
    try {
        const customId = interaction.customId;
        let scriptName, action;

        if (customId.startsWith('get_script_')) {
            action = 'get_script';
            scriptName = customId.substring('get_script_'.length);
        } else if (customId.startsWith('redeem_key_')) {
            action = 'redeem_key';
            scriptName = customId.substring('redeem_key_'.length);
        } else if (customId.startsWith('view_stats_')) {
            action = 'view_stats';
            scriptName = customId.substring('view_stats_'.length);
        } else if (customId.startsWith('reset_hwid_')) {
            action = 'reset_hwid';
            scriptName = customId.substring('reset_hwid_'.length);
        } else {
            return interaction.reply({
                embeds: [createErrorEmbed('Invalid Action', 'Unknown button action.')],
                ephemeral: true
            });
        }

        const userId = interaction.user.id;
        const userAccess = dataManager.getUserAccess(userId, scriptName);

        if (!userAccess && action !== 'redeem_key') {
            return interaction.reply({
                embeds: [createErrorEmbed('No Access', 'You do not have access to this script.')],
                ephemeral: true
            });
        }

        switch (action) {
            case 'get_script':
                const script = dataManager.getScript(scriptName);
                if (!script) {
                    return interaction.reply({
                        embeds: [createErrorEmbed('Script Not Found', 'Script file not found.')],
                        ephemeral: true
                    });
                }

                userAccess.access_count++;
                dataManager.saveData();

                const displayName = script.display_name || scriptName;
                const loadstringCode = `local userId = "${userId}"\nlocal scriptName = "${scriptName}"\nlocal url = "${CONFIG.WEBSITE_URL}/loadstring?userId=" .. userId .. "&scriptName=" .. scriptName\nloadstring(game:HttpGet(url))()`;
                const embed = createSuccessEmbed(
                    'Script Retrieved',
                    `Successfully retrieved the loadstring for **${displayName}**`
                );
                embed.addFields({
                    name: '📜 Loadstring Code',
                    value: `\`\`\`lua\n${loadstringCode}\n\`\`\``,
                    inline: false
                });
                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;

            case 'redeem_key':
                const modal = new ModalBuilder()
                    .setCustomId(`redeem_key_modal_${scriptName}`)
                    .setTitle(`Redeem Key for ${scriptName}`);

                const keyInput = new TextInputBuilder()
                    .setCustomId('license_key')
                    .setLabel('Enter your license key')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(keyInput);
                modal.addComponents(firstActionRow);

                await interaction.showModal(modal);
                break;

            case 'view_stats':
                const scriptDisplayName = dataManager.getScriptDisplayName(scriptName) || scriptName;
                const statsEmbed = createInfoEmbed(
                    `${scriptDisplayName} Statistics`,
                    `Your statistics for **${scriptDisplayName}**`,
                    [
                        { name: '🔑 License Key', value: `\`${userAccess.license_key}\``, inline: true },
                        { name: '🔧 HWID', value: `\`${userAccess.hwid}\``, inline: true },
                        { name: '📊 Access Count', value: userAccess.access_count.toString(), inline: true },
                        { name: '📅 Whitelisted', value: `<t:${Math.floor(new Date(userAccess.created_at).getTime() / 1000)}:F>`, inline: true },
                        { name: '🔄 Last Reset', value: userAccess.last_reset ? `<t:${Math.floor(new Date(userAccess.last_reset).getTime() / 1000)}:R>` : 'Never', inline: true }
                    ]
                );

                await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
                break;

            case 'reset_hwid':
                dataManager.resetUserHWID(userId, scriptName);
                const newAccess = dataManager.getUserAccess(userId, scriptName);
                const resetDisplayName = dataManager.getScriptDisplayName(scriptName) || scriptName;
                const resetEmbed = createSuccessEmbed(
                    'HWID Reset',
                    `Your HWID has been reset for **${resetDisplayName}**`,
                    [
                        { name: '🔧 New HWID', value: `\`${newAccess.hwid}\``, inline: true },
                        { name: '🔄 Reset Time', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
                    ]
                );

                await interaction.reply({ embeds: [resetEmbed], ephemeral: true });
                break;
        }
    } catch (error) {
        console.error('Button interaction error:', error);
        await interaction.reply({
            embeds: [createErrorEmbed('Error', 'Failed to process button interaction.')],
            ephemeral: true
        });
    }
}

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isCommand()) {
            const { commandName } = interaction;

            switch (commandName) {
                case 'whitelist':
                    await handleWhitelist(interaction);
                    break;
                case 'upload-script':
                    await handleUploadScript(interaction);
                    break;
                case 'reset-hwid':
                    await handleResetHWID(interaction);
                    break;
                case 'setpanel':
                    await handlePanel(interaction);
                    break;
                case 'generatekeys':
                    await handleGenerateKeys(interaction);
                    break;
                case 'refill_keys':
                    await handleRefillKeys(interaction);
                    break;
                default:
                    await interaction.reply({
                        embeds: [createErrorEmbed('Unknown Command', 'This command is not recognized.')],
                        ephemeral: true
                    });
            }
        } else if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('redeem_key_modal_')) {
                const scriptName = interaction.customId.substring('redeem_key_modal_'.length);
                const licenseKey = interaction.fields.getTextInputValue('license_key');
                const success = dataManager.redeemKey(interaction.user.id, scriptName, licenseKey);

                if (success) {
                    const embed = createSuccessEmbed(
                        'Key Redeemed',
                        `Successfully redeemed a key for **${scriptName}**`
                    );
                    await interaction.reply({ embeds: [embed], ephemeral: true });
                } else {
                    await interaction.reply({
                        embeds: [createErrorEmbed('Invalid Key', 'The provided license key is invalid or has already been used.')],
                        ephemeral: true
                    });
                }
            }
        } else if (interaction.isAutocomplete()) {
            const focusedOption = interaction.options.getFocused(true);

            if (focusedOption.name === 'script') {
                const scripts = dataManager.getAllScripts();
                const filtered = scripts
                    .filter(script => {
                        const displayName = dataManager.getScriptDisplayName(script) || script;
                        return displayName.toLowerCase().includes(focusedOption.value.toLowerCase());
                    })
                    .slice(0, 25)
                    .map(script => ({
                        name: dataManager.getScriptDisplayName(script) || script,
                        value: script
                    }));

                await interaction.respond(filtered);
            }
        }
    } catch (error) {
        console.error('Interaction error:', error);

        if (interaction.deferred) {
            await interaction.editReply({
                embeds: [createErrorEmbed('Error', 'An error occurred while processing your request.')],
                ephemeral: true
            });
        } else if (!interaction.replied) {
            await interaction.reply({
                embeds: [createErrorEmbed('Error', 'An error occurred while processing your request.')],
                ephemeral: true
            });
        }
    }
});

client.once('ready', () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    console.log(`📊 Loaded ${dataManager.getAllScripts().length} scripts`);
    console.log(`👥 Serving ${Object.keys(dataManager.data.users).length} users`);
});

client.on('error', (error) => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\n🔄 Received SIGINT, shutting down gracefully...');
    dataManager.saveData();
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🔄 Received SIGTERM, shutting down gracefully...');
    dataManager.saveData();
    client.destroy();
    process.exit(0);
});

async function startBot() {
    try {
        console.log('🚀 Starting ScriptGuard Pro Discord Bot...');
        await registerCommands();
        await client.login(CONFIG.TOKEN);
        console.log('✅ Bot started successfully!');
        console.log('📋 Available commands:');
        console.log('   • /whitelist - Add user to script whitelist');
        console.log('   • /upload-script - Upload and protect a script');
        console.log('   • /reset-hwid - Reset user HWID');
        console.log('   • /setpanel - Create control panel in a channel');
        console.log('   • /generatekeys - Generate license keys');
        console.log('   • /refill_keys - Refill keys from a text file');
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startBot();
}

module.exports = {
    client,
    dataManager,
    startBot
};


client.login(token);