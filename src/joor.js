const axios = require('axios');

class JoorBase {
    constructor(authData, apiVersion = 'v4') {
        this.apiVersion = apiVersion;
        this.baseURL = `https://apisandbox.jooraccess.com/${this.apiVersion}`;
        this.authData = authData;
        this.token = this.apiVersion === 'v4' ? '' : this.encodeToken(authData.token);
        if (this.apiVersion === 'v4') {
            this.authURL = "https://atlas-sandbox.jooraccess.com/auth";
            this.authenticate();
        }
    }

    encodeToken(token) {
        return Buffer.from(token).toString('base64');
    }

    async authenticate() {
        if (this.apiVersion === 'v4') {
            try {
                const params = new URLSearchParams();
                Object.keys(this.authData).forEach(key => params.append(key, this.authData[key]));
        
                const response = await axios.post(this.authURL, params, {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                if (response.status === 200) {
                    this.token = response.data.access_token;
                }
            } catch (error) {
                console.error('Authentication failed:', error);
                throw error;
            }
        }
    }

    async sendRequest(endpoint, method = 'GET', data = null) {
        try {
            const url = this.baseURL + endpoint;
            const headers = {
                'Authorization': `Bearer ${this.token}`,
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
            console.error('Error sending request:', error);
            throw error;
        }
    }
}

class JoorProducts extends JoorBase {

    async getProducts(accountId) {
        return this.sendRequest(`/products?account=${accountId}`, 'GET');
    }
    async getSkus(accountId) {
        return this.sendRequest(`/skus?account=${accountId}`, 'GET');
    }

    async getPriceTypes(accountId) {
        return this.sendRequest(`/price_types?account=${accountId}`, 'GET');
    }

    async postProductsToCreate(accountId, data) {
        return this.sendRequest(`/products/bulk_create?account=${accountId}`, 'POST', data);
    }

    async postProductsToUpdate(accountId, data) {
        return this.sendRequest(`/products/bulk_update?account=${accountId}`, 'POST', data);
    }

    async postSkusToCreate(accountId, data) {
        var mappedSkus = data;
        var responseData = [];
        for (var i = 0; i < mappedSkus.length; i++) {
            var setOfSkus = mappedSkus[i]['skus'];
            var groupedSkuID = mappedSkus[i]['product_id'];
            try {
                var response = await this.sendRequest(`/skus/bulk_create?account=${accountId}`, 'POST', setOfSkus);
                var test = {[groupedSkuID]: response['data']};
                responseData.push(test);
            } catch (error) {
                console.error('Error posting SKUs:', error);
                // push error information to responseData if needed
                //responseData.push({ error: 'Failed to post SKUs', details: error.message });
            }
        }
        return responseData;
    }

    async postSkusToUpdate(accountId, data) {
        var mappedSkus = data;
        var responseData = [];
        for (var i = 0; i < mappedSkus.length; i++) {
            var setOfSkus = mappedSkus[i]['skus'];
            var groupedSkuID = mappedSkus[i]['product_id'];
            try {
                var response = await this.sendRequest(`/skus/bulk_update_by_external_id?account=${accountId}`, 'POST', setOfSkus);
                var test = {[groupedSkuID]: response['data']};
                responseData.push(test);

                // Need to add error logging
            } catch (error) {
                console.error('Error posting SKUs:', error);
                //responseData.push({ error: 'Failed to post SKUs', details: error.message });
            }
        }
        return responseData;
    }

    async postPrices(accountId, data) {
        return this.sendRequest(`/prices/bulk_create?account=${accountId}`, 'POST', data);
    }
    async postInventory(data) {
        if (this.apiVersion === 'v2') {
            const endpoint = '/bulk-inventory';
            return this.sendRequest(endpoint, 'POST', data);
        } else {
            throw new Error("postInventory is only available for the V2 API.");
        }
    }
}

class JoorCollections extends JoorBase {

    async createCollections() {

    }

    async updateCollections() {

    }

    async getCollections(accountId) {
        return this.sendRequest(`/collections?account=${accountId}`, 'GET');
    }

}

class JoorSeasons extends JoorBase {
    async createSeasons() {

    }

    async updateSeasons() {

    }

}

// Export all classes
module.exports = {
    JoorBase,
    JoorProducts,
    JoorCollections
};