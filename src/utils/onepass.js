require('dotenv').config();
const axios = require('axios');
const { vary } = require('express/lib/response');
const fs = require('fs').promises; 

class OnepassBase {
    constructor(apiToken) {
        this.apiToken = apiToken;
        this.baseUrl = "http://127.0.0.1:8080/v1/vaults/o4u3uba4fnb5ktkjv3v6ruhnfu/items"; 
    }

    async sendRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = this.baseUrl + endpoint; 
            const headers = {
                'Authorization': `Bearer ${this.apiToken}`, 
                'Accept': 'application/json'
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

class OnepassVault extends OnepassBase {
    async getVaultData(vault) {
        return this.sendRequest(`/${vault}`);
    }

    async grabGithubToken(onepass,vaultId) {
        try {
            var githubToken = ""
            var onepassList = await onepass.getVaultData(vaultId);
    
            onepassList.forEach(vault => {
                if(vault.title == 'Github') {
                    vaultId = vault.id;
                }
            })
    
            // Grab github token
            var githubVault = await onepass.getVaultData(vaultId);
            githubVault.fields.forEach(item => {
                if(item.id == 'credential') {
                    githubToken = item.value
                }
            })
            return githubToken
        } catch (error) {
            //console.error('failed to fetch vault data: ', error)
        }
    }

    async grabConfigKeys(onepass,vaultId) {
        try {
            var configTokens  = {}

            //var onepassList = await onepass.getVaultData(vaultId);

            /*
            onepassList.fields.forEach(vault => {
                console.log(vault)
                if(vault.id == 'username') {
                    joorUsername = vault.id;
                }
            })
            */
            // Grab github token
            var githubVault = await onepass.getVaultData(vaultId);
            githubVault.fields.forEach(item => {
                if(item.label == 'username') {
                    configTokens.joorUsername = item.value
                }
                if(item.label == 'credential') {
                    configTokens.joorPassword = item.value
                }
                if(item.label.toLowerCase() == 'client_id') {
                    configTokens.clientId = item.value
                }
                if(item.label.toLowerCase() == 'client_secret') {
                    configTokens.clientSecret = item.value
                }
                if(item.label.toLowerCase() == 'v2_token') {
                    configTokens.apiV2 = item.value
                }
                if(item.label.toLowerCase() == 'shopify_token') {
                    configTokens.shopify_token = item.value
                }
            })
            return configTokens;
            //return {joorUsername, joorPassword, clientId, clientSecret, apiV2, store_name, shopify_token}
        } catch (error) {
           // console.error('failed to fetch vault data: ', error)
        }
    }
}

module.exports = {
    OnepassBase,
    OnepassVault
};