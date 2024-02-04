require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises; 

const {
    OnepassBase,
    OnepassVault
} = require('./onepass');

const {
    SlackBase,
    SlackActions
} = require('./slack');

class GithubBase {
    constructor(apiToken, apiKey, storeUrl) {
        this.apiToken = apiToken;
        this.apiKey = apiKey;
        this.storeUrl = storeUrl;
        this.baseUrl = `https://api.github.com/repos/joor/tray.io/contents/namespaces`;
    }

    async sendRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = this.baseUrl + endpoint; 
            const headers = {
                'Authorization': `Bearer ${this.apiToken}`, 
                'Content': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            };

            if (method === 'POST' && data) {
                headers['Content-Type'] = 'application/json';
            }

            const config = {
                method: method,
                url: url,
                headers: headers,
                data: data
            };

            const response = await axios(config);
            if ([200, 201].includes(response.status)) {
                return response.data;
            }
        } catch (error) {
            //console.error('Error sending request:', error);
            throw error;
        }
    }
}

class GithubRepo extends GithubBase {

    async getAndDecodeJSON(configUrl){
        const getSandboxData = await this.sendRequest(configUrl);
        const base64Content = getSandboxData.content;
        const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');
        const data = JSON.parse(decodedContent);
        
        return data;
    }

    async getSandboxRepo() {
        return this.sendRequest(`/sandbox-integrations/applications/shopify_test`);
    }

    async getDefaultConfig() {
        try {
            
            const configUrl = `/sandbox-integrations/applications/shopify_test/default_config.json`;
            const defaultConfig = await this.getAndDecodeJSON(configUrl);

            return defaultConfig;
        } catch (error) {
            console.error(`Failed to process ${configName}:`, error);
            throw error; 
        }
    }

    async getDataContainer() {
        try {
            const configUrl = `/sandbox-integrations/applications/shopify_test/data_container.json`;
            const dataContainer = await this.getAndDecodeJSON(configUrl);

            return dataContainer;
        } catch (error) {
            console.error(`Failed to process ${configName}:`, error);
            throw error;
        }
    }
    async compileConfigData(configList, onepass) {
        let configData = [];
        for (const configName of configList) {
            try {
                const configUrl = `/sandbox-integrations/applications/shopify_test/${configName}`;
                const storeConfig = await this.getAndDecodeJSON(configUrl);

                // assign our keys to a variable
                const keys = await onepass.grabConfigKeys(onepass,storeConfig.tokens.onepassword_vault_id);
                // Add keys to storeConfig
                Object.assign(storeConfig.tokens, keys);

                configData.push(storeConfig);
            } catch (error) {
                console.error(`Failed to process ${configName}:`, error);
                throw error;
            }
        }
        return configData;
    }
}
module.exports = {
    GithubBase,
    GithubRepo
};
