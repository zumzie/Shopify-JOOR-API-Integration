require('dotenv').config();
const axios = require('axios');

class SlackBase {
    constructor() {
        this.baseURL = "https://slack.com/api";
        this.token = process.env.SLACK_BOT_TOKEN; // need to adjust so we get this from onepassword. too lazy, will do soon
        this.channel = 'C06GEE11TK9';
    }

    async sendRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = `${this.baseURL}/${endpoint}`;
            const headers = {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            const config = {
                method: method,
                url: url,
                headers: headers,
                data: data
            };

            const response = await axios(config);
            if ([200, 201].includes(response.status)) {
                return response.data;
            } else {
                throw new Error(`API request failed with status ${response.status}`);
            }
        } catch (error) {
            //console.error('Error sending request:', error);
            throw error;
        }
    }
}

class SlackActions extends SlackBase {
    async sendMessage(text) {
        const data = {
            channel: this.channel,
            text: text
        };
        return this.sendRequest('chat.postMessage', 'POST', data);
    }
    async runningStoreConfig(configStoreName, timeScope) {
        const data = {
            channel: this.channel,
            text: `:shopify: :: \`${configStoreName}\`@ _apisandbox.jooraccess.com_ => :alarm_clock: Store is currently syncing data. Please decrease your timescope *${JSON.stringify(timeScope)}*!`
        };
        return this.sendRequest('chat.postMessage', 'POST', data);
    }
}

module.exports = {
    SlackBase,
    SlackActions
};