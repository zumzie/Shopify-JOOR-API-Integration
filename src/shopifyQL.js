require('dotenv').config();
const axios = require('axios');

//not trying to get on darkweb. mentally held hostage

class ShopifyGraphQL {
    constructor(shopifyKey, storeUrl, shopifyVersion) {
        this.shopifyKey = shopifyKey;
        this.storeUrl = storeUrl;
        this.baseUrl = `https://${storeUrl}/admin/api/${shopifyVersion}/graphql.json`;
    }

    async sendRequest(query) {
        try {
            const response = await axios.post(this.baseUrl, {
                query: query
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': this.shopifyKey
                }
            });

            if (response.status === 200) {
                return response.data;
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
}
class ShopifyProductsQL extends ShopifyGraphQL {
    async getProducts() {
        const query = `
        query {
            products(first: 5) {
                edges {
                    node {
                        id
                        handle
                    }
                }
                pageInfo {
                    hasNextPage
                }
            }
        }`;
        return this.sendRequest(query);
    }

    async getProducts(tempTimeStamp) {
        const query = `
        query {
            products(first: 100, query: "updated_at:>=${tempTimeStamp}") {
                edges {
                    node {
                        id
                        title
                        handle
                        bodyHtml
                        productType
                        tags
                        variants {
                            id
                            title
                            sku
                            price
                            inventoryQuantity
                        }
                        options {
                            id
                            name
                            values
                        }
                        images {
                            id
                            src
                        }
                        image {
                            id
                            src
                        }
                        vendor
                        templateSuffix
                        publishedScope
                        status
                    }
                }
                pageInfo {
                    hasNextPage
                }
            }
        }`;
        return this.sendRequest(query);
    }
}

module.exports = {
    ShopifyGraphQL,
    ShopifyProductsQL
};