require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises; // For async file operations

class ShopifyBase {
    constructor(shopifyKey, storeUrl, shopifyVersion) {
        this.shopifyKey = shopifyKey;
        this.storeUrl = storeUrl;
        this.baseUrl = `https://${shopifyKey}@${storeUrl}/admin/api/${shopifyVersion}/`;
    }

    async sendRequest(endpoint) {
        try {
            const url = this.baseUrl + endpoint;
            const response = await axios.get(url, {
                auth: {
                    username: this.shopifyKey.split(':')[0], // shopifyToken:ShopifyKey -> shopifyToken
                    password: this.shopifyKey.split(':')[1] // // shopifyToken:ShopifyKey -> ShopifyKey
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

class ShopifyProducts extends ShopifyBase {
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

class ShopifyCollections extends ShopifyBase {
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

class ShopifyInventory extends ShopifyBase {
    async getLocations(){
        return this.sendRequest('locations.json');
    }

    async processLocations(locations){
        var locationIds = [];
        locations['locations'].forEach(location => {
            locationIds.push(location['id'])
        })
        return locationIds;
    }

    async getLocationInventory(locationIds, time_diff){
        return this.sendRequest(`inventory_levels.json?location_ids=${locationIds}&updated_at_min=${time_diff}`);
    }

    async processLocationInventory(locationInventory){
        var locationInventoryList = {'inventory_levels': []}
        for(var i = 0; i < locationInventory['inventory_levels'].length; i++){
            var inventoryObj = locationInventory['inventory_levels'][i];
            if ('admin_graphql_api_id' in inventoryObj) {
                delete inventoryObj.admin_graphql_api_id;
            }
            if ('updated_at' in inventoryObj) {
                delete inventoryObj.updated_at;
            }
            locationInventoryList['inventory_levels'].push(inventoryObj);
        }
        return locationInventoryList;
    }
}


// Export all classes
module.exports = {
    ShopifyBase,
    ShopifyProducts,
    ShopifyCollections,
    ShopifyInventory
};