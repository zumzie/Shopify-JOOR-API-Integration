require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises; 

const {
    OnepassBase,
    OnepassVault
} = require('./onepass');

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
            console.error('Error sending request:', error);
            throw error;
        }
    }
}

class GithubRepo extends GithubBase {
    async getSandboxRepo() {
        return this.sendRequest(`/sandbox-integrations/applications/shopify_test`);
    }
    async getFileContent(configList) {
        try {
                //configList.forEach(config => {
                var configUrl = `/sandbox-integrations/applications/shopify_test/${configList[0]}`
                console.log(configUrl)
                return this.sendRequest(configUrl);
            //})
        } catch (error) {
            console.log("Ran into an error with config:" + error);
        }
    }
}

// Below is for testing, will be adding to main
(async () => {
    try {
    const apiToken = process.env.PASS_TOKEN;
    var vaultId = "";
    var githubToken = ""

    const onepass = new OnepassVault(apiToken);
    var githubToken = await onepass.grabGithubToken(vaultId);
    const github = new GithubRepo(githubToken);


    var sandboxList = await github.getSandboxRepo(githubToken);

    var configList = [];

    sandboxList.forEach(config => {
        configName = config.name;
        if(configName.startsWith("config_")){
            configList.push(configName);
            console.log(configList)
        }
    });

    var getSandboxData = await github.getFileContent(configList);

    const base64Content = getSandboxData.content; 
    const decodedContent = Buffer.from(base64Content, 'base64').toString('utf-8');

    
    const jsonContent = JSON.parse(decodedContent);
    console.log(jsonContent);


} catch (e) {
    console.error(`An error occurred: ${e}`);
}
})();