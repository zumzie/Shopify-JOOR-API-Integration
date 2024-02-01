require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises; // For async file operations
const {
    ShopifyBase,
    ShopifyProducts,
    ShopifyCollections,
    ShopifyInventory
} = require('./shopify');

const {
    JoorBase,
    JoorProducts,
    JoorCollections
} = require('./joor');

const {
    DataMapper,
    ProductMapper,
} = require('./mapper/products');


async function writeToFile(filename, data) {
    try {
        await fs.writeFile(filename, JSON.stringify(data, null, 4));
        console.log(`Data successfully written to ${filename}`);
    } catch (error) {
        console.error(`Error writing to file: ${error.message}`);
    }
}


async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading file:", filePath, error);
        throw error;
    }
}

async function processFiles() {
    try {
        const configData = await readJsonFile('default_config.json');
       return configData
    } catch (error) {
        console.error("Error processing files:", error);
    }
}

(async () => {
    try {

        // Flag variables, to be cleaned up
        var tempTimeStamp = "2023-01-27T05:11:54.473Z";
        const currentTimestampIso = new Date().toISOString();

        var updateFlag = false;
        var createFlag = false;
        var existingProducts = false;

        var styleFlag = true;
        var inventoryFlag = true; // should be false, set to true for testing
        var imageFlag = false;

        // Temporary variables for auth, will create class to call shopify data from 1password
        const apiToken = process.env.SHOPIFY_API_TOKEN;
        const apiKey = process.env.SHOPIFY_KEY;
        const storeUrl = 'joor-test-store.myshopify.com';
        const accountId = process.env.ACCOUNT_ID

        // Going to use 1password to gather api creds
        var authData = {
            'client_id': process.env.CLIENT_ID,
            'grant_type': 'password',
            'client_secret': process.env.CLIENT_SECRET,
            'username': process.env.USERNAME,
            'password': process.env.PASSWORD,
        }

        // Initialize shopify classes
        const shopifyProducts = new ShopifyProducts(apiToken, apiKey, storeUrl);
        const shopfiyCollections = new ShopifyCollections(apiToken, apiKey, storeUrl);
        const shopifyInventory = new ShopifyInventory(apiToken, apiKey, storeUrl);

        // Initialize joor classes
        const joorProducts = new JoorProducts(authData);
        const joorCollections = new JoorCollections(authData);

        // Initialize mapper classes
        const mapProductData = new ProductMapper(configData);

        // temp variabl to read default config
        var configData = await processFiles()


        // Initiate joorProduct Auth and call to see if we have products in JOOR
        await joorProducts.authenticate();
        const joorProductsList = await joorProducts.getProducts(accountId);

        // Check if we have joorProducts, if so we mark our existingProducts flag as true
        if(joorProductsList.data.length > 0){
            existingProducts = true;
        }

        // Create update and create Arrays
        var productsToUpdate = [];
        var productsToCreate = [];

        // Check if our exiting product flag is true, if so; we need to then check if any products have been modifed/created recently
        // then we start gathering data the rest of the data from shopify
        if(existingProducts) {
            var prodIds = await shopifyProducts.getProductsIds();
            var products = await shopifyProducts.getProducts(tempTimeStamp);
            if(products) {
                var productListings = await shopfiyCollections.getCollections();
                var processedListings = await shopfiyCollections.processCollections(productListings);
                var customCollections = await shopfiyCollections.getCustomCollections(processedListings);
                var smartCollections = await shopfiyCollections.getSmartCollections(processedListings);
        
                // Combines all our collections
                var allCollections = []
                customCollections['custom_collections'].forEach(customCollection => {
                    allCollections.push(customCollection);
                });
                smartCollections['smart_collections'].forEach(smartCollection => {
                    allCollections.push(smartCollection)
                });
        
        
                // Loop through allCollection IDs to make shopify call to gather all products in those collections
                var productsInCollections = [];
                for(var i = 0; i < allCollections.length; i++) {
                    collectionId = allCollections[i]['id']
                    var data = await shopfiyCollections.getProdCollection(collectionId)
                    data.products.forEach( product => {
                        if(product.status.toLowerCase() == 'active'){
                            productsInCollections.push(product)
                        }
                    })
                }

                // Once we get our products from our collections, we need to compare them to our joorList to see which products will be updated.
                productsInCollections.forEach(shopifyProduct => {
                    var shopifyProductID = shopifyProduct['id'].toString();
                    joorProductsList.data.forEach(joorProduct => {
                        var joorProductID = joorProduct['product_identifier'];
                        if (joorProductID == shopifyProductID){
                            productsToUpdate.push(shopifyProduct);
                        }
                    });
                });
                // If we have products to update, we set our updateFlag to true
                if (productsToUpdate.length > 0) {
                    updateFlag = true;
                }
            }
            // gather joor prices and skus
            var joorPrices = await joorProducts.getPriceTypes(accountId);
            var joorSkus = await joorProducts.getSkus(accountId);
        }
        else if (products){
            // If we don't have existing products, we need to gather the rest of our data to see what products need to be created
            var prodIds = await shopifyProducts.getProductsIds();
            var products = await shopifyProducts.getProducts(tempTimeStamp);
            var productListings = await shopfiyCollections.getCollections();
            var processedListings = await shopfiyCollections.processCollections(productListings);
            var customCollections = await shopfiyCollections.getCustomCollections(processedListings);
            var smartCollections = await shopfiyCollections.getSmartCollections(processedListings);
            // Combines all our collections
            var allCollections = []
            customCollections['custom_collections'].forEach(customCollection => {
                allCollections.push(customCollection);
            });
            smartCollections['smart_collections'].forEach(smartCollection => {
                allCollections.push(smartCollection)
            });
            // Loop through allCollection IDs to make shopify call to gather all products in those collections
            var productsInCollections = [];
            for(var i = 0; i < allCollections.length; i++) {
                collectionId = allCollections[i]['id']
                var data = await shopfiyCollections.getProdCollection(collectionId)
                data.products.forEach( product => {
                    if(product.status.toLowerCase() == 'active'){
                        productsInCollections.push(product)
                    }
                })
            }
        }

         // Push metafields into their corresponding product
        // {'product_id': metafieldobjects} -> {'95458234': [{key: custom.wholesale_usd}, 'value': '96.00'},...]}
        var metafieldList = []
        for (var i = 0; i < prodIds['product_ids'].length; i++){
            var productId = prodIds['product_ids'][i];
            var productMetafield = await shopifyProducts.getProductMetafields(productId)
            var processedMetafields = await shopifyProducts.processedProductMetafields(productId,productMetafield)
            metafieldList.push(processedMetafields)
        }

        // if our update flag is true, we start mapping our data. next, we send our mapped data to be updated
        if (updateFlag) {
            // If Store Config Style Flag is true
            if(styleFlag) {
                //var metafields = await mapProductData.mapMetafields(shopifyProducts,prodIds);
                //console.log(metafields);
                // Map Data to be updated
                var mappedProductsToUpdate = await mapProductData.mapProductsToUpdate(joorProductsList, productsToUpdate, configData);
                var mappedSkusToUpdate = await mapProductData.mapSkusToUpdate(productsToUpdate, products, configData);

                // Send Data to be updated
                var updatedProductsResponse = await joorProducts.postProductsToUpdate(accountId, mappedProductsToUpdate)
                var updatedSkusResponse = await joorProducts.postSkusToUpdate(accountId, mappedSkusToUpdate)
            }
        }
        if (createFlag) {
            // If Store Config Style Flag is true
            if(styleFlag) {
                // Map Prod Data to be created and send data to be created
                var mappedProductsToCreate = await mapProductData.mapProductsToCreate(joorProductsList, products, configData);
                var createdProductsResponse = await joorProducts.postProductsToCreate(accountId, mappedProductsToCreate);

                // Map Sku Data to be created and send data to be created
                var mappedSkusToCreate = await mapProductData.mapSkusToCreate(productResponse, products, configData);
                var createdSkusResponse = await joorProducts.postSkusToCreate(accountId, mappedSkusToCreate);

                // Map Price Data to be created and send data to be created
                var mappedPrices = await mapProductData.mapPrices(products,createdSkusResponse,configData);
                var pricesResponse = await joorProducts.postPrices(accountId, mappedPrices);
            }
        }
        // If Store Config Inventory Flag is true
        if(inventoryFlag) {
            var mappedInventory = await mapProductData.mapInventory(products, configData);
        }
        // If Store Config Image Flag is true
        if(imageFlag) {

        }

        // Using temporarily to help troubleshoot/debug. Will create Slack logs to assist in the future
        await writeToFile('jsonFiles/productIds.json', prodIds);
        await writeToFile('jsonFiles/products.json', products);
        await writeToFile('jsonFiles/productListings.json', productListings);
        await writeToFile('jsonFiles/customCollections.json', customCollections);
        await writeToFile('jsonFiles/smartCollections.json', smartCollections);
        await writeToFile('jsonFiles/allCollections.json', allCollections);
        await writeToFile('jsonFiles/productsInCollections.json', productsInCollections);
        await writeToFile('jsonFiles/joorProductsList.json', joorProductsList);
        await writeToFile('jsonFiles/productsToUpdate.json', productsToUpdate);
        await writeToFile('jsonFiles/productsToCreate.json', productsToCreate);
        await writeToFile('jsonFiles/mappedProductsToUpdate.json', mappedProductsToUpdate);
        await writeToFile('jsonFiles/mappedSkusToUpdate.json', mappedSkusToUpdate);
        await writeToFile('jsonFiles/mappedInventory.json', mappedInventory);

    } catch (e) {
        console.error(`An error occurred: ${e}`);
    }
})();



 /*
        joorProductsList.data.forEach(joorProduct => {
                    var joorProductID = joorProduct['product_identifier'];
                    productsInCollections.forEach(shopifyProduct => {
                        var shopifyProductID = shopifyProduct['id'].toString();
                        if (joorProductID == shopifyProductID){
                            productsToUpdate.push(shopifyProductID);
                        } else {
                            productsToCreate.push(shopifyProductID);
                        }
                    })
                })
        const locations = await shopifyInventory.getLocations();
        const processedLocations = await shopifyInventory.processLocations(locations);
        const locationInventory = await shopifyInventory.getLocationInventory(processedLocations,tempTimeStamp);
        const processedInventory = await shopifyInventory.processLocationInventory(locationInventory);

        */
 /*
        // Call functions
        const prodIds = await shopifyProducts.getProductsIds();
        const products = await shopifyProducts.getProducts();
        const productListings = await shopfiyCollections.getCollections();
        const processedListings = await shopfiyCollections.processCollections(productListings);
        const customCollections = await shopfiyCollections.getCustomCollections(processedListings);
        const smartCollections = await shopfiyCollections.getSmartCollections(processedListings);
        const locations = await shopifyInventory.getLocations();
        const processedLocations = await shopifyInventory.processLocations(locations);
        const locationInventory = await shopifyInventory.getLocationInventory(processedLocations, time_diff="2021-12-18T02:22:55Z");
        const processedInventory = await shopifyInventory.processLocationInventory(locationInventory);
        const joorProductsList = await joorProducts.getProducts(accountId);

        console.log(joorProductsList)

        // Push metafields into their corresponding product
        // {'product_id': metafieldobjects} -> {'95458234': [{key: custom.wholesale_usd}, 'value': '96.00'},...]}
        var metafieldList = []
        for (var i = 0; i < prodIds['product_ids'].length; i++){
            var productId = prodIds['product_ids'][i];
            var productMetafield = await shopifyProducts.getProductMetafields(productId)
            var productMetafields = await shopifyProducts.processedProductMetafields(productId,productMetafield)
            metafieldList.push(productMetafields)
        }
        
        // Combines all our collections
        var allCollections = []
        customCollections['custom_collections'].forEach(customCollection => {
            allCollections.push(customCollection);
        });
        smartCollections['smart_collections'].forEach(smartCollection => {
            allCollections.push(smartCollection)
        });

        await writeToFile('jsonFiles/productIds.json', prodIds);
        await writeToFile('jsonFiles/products.json', products);
        await writeToFile('jsonFiles/productListings.json', productListings);
        await writeToFile('jsonFiles/customCollections.json', customCollections);
        await writeToFile('jsonFiles/smartCollections.json', smartCollections);
        await writeToFile('jsonFiles/allCollections.json', allCollections);

        // Temporay, need to create flow control
        configData = await processFiles()
        const mapProductData = new ProductMapper(configData);
        const mappedProducts = await mapProductData.mapProducts(products, configData);
        const productResponse = await joorProducts.postProducts(accountId, mappedProducts);
        const mappedSkus = await mapProductData.mapSkus(products,productResponse,configData);
        var skuResponse =  await joorProducts.postSkus(accountId, mappedSkus);
        var joorPrices = await joorProducts.getPriceTypes(accountId);
        var mappedPrices = await mapProductData.mapPrices(products,skuResponse,configData);
        var pricesResponse = await joorProducts.postPrices(accountId, mappedPrices);

        // Will delete, makes data easier to spot check
        await writeToFile('jsonFiles/productIds.json', prodIds);
        await writeToFile('jsonFiles/products.json', products);
        await writeToFile('jsonFiles/productListings.json', productListings);
        await writeToFile('jsonFiles/customCollections.json', customCollections);
        await writeToFile('jsonFiles/smartCollections.json', smartCollections);
        await writeToFile('jsonFiles/allCollections.json', allCollections);
        await writeToFile('jsonFiles/mappedProducts.json', mappedProducts);
        await writeToFile('jsonFiles/productResponse.json', productResponse);
        await writeToFile('jsonFiles/mappedSkus.json', mappedSkus);
        await writeToFile('jsonFiles/skuResponse.json', skuResponse);
        await writeToFile('jsonFiles/joorPrices.json', joorPrices);
        await writeToFile('jsonFiles/mappedPrices.json', mappedPrices);
        await writeToFile('jsonFiles/pricesResponse.json', pricesResponse);
        await writeToFile('jsonFiles/joorProductsList.json', joorProductsList);
        */