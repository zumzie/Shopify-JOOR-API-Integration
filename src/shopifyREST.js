require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises; // For async file operations

class ShopifyREST {
    constructor(accessToken, storeUrl, shopifyVersion) {
        this.accessToken = accessToken;
        this.storeUrl = storeUrl;
        this.baseUrl = `https://${storeUrl}/admin/api/${shopifyVersion}/`;
    }

    async sendRequest(endpoint) {
        try {
            const url = this.baseUrl + endpoint;
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': this.accessToken
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

class ShopifyProductsREST extends ShopifyREST {
    async getProductsIds() {
        return this.sendRequest('product_listings/product_ids.json');
    }

    async getProducts(tempTimeStamp) {
        return this.sendRequest(`/products.json?updated_at_min=${tempTimeStamp}&fields=id,title,handle,body_html,product_type,tags,variants,options,images,image,vendor,template_suffix,published_scope,status`);
    }

    async getProductMetafields(productId){
        return this.sendRequest(`products/${productId}/metafields.json`);
    }

    async processedProductMetafields(productId,metafieldData){
        var metafieldObj = {};
        metafieldObj[`${productId}`] = metafieldData['metafields'];
        return metafieldObj;
    }

}

class ShopifyCollectionsREST extends ShopifyREST {
    async getCollections(){
        return this.sendRequest('collection_listings.json?limit=250');
    }
    
    async getCustomCollections(collectionIds){
        var combinedCollectionIds = collectionIds.join(',');
        return this.sendRequest(`custom_collections.json?limit=250&ids=${combinedCollectionIds}&fields=id,title,updated_at`);
    }

    async getSmartCollections(collectionIds){
        var combinedCollectionIds = collectionIds.join(',');
        return this.sendRequest(`smart_collections.json?limit=250&ids=${combinedCollectionIds}&fields=id,title,updated_at`);
    }
    
    async getProdCollection(collectionId){
        return this.sendRequest(`collections/${collectionId}/products.json?fields=id,title,handle,body_html,product_type,tags,variants,options,images,image,status,vendor,template_suffix`);
    }
    
    async processCollections(collections){
        var collectionData = [];
        collections['collection_listings'].forEach(collection => {
            collectionData.push(collection['collection_id']);
        });
        return collectionData;
    }
    
}


module.exports = {
    ShopifyREST,
    ShopifyProductsREST,
    ShopifyCollectionsREST
};