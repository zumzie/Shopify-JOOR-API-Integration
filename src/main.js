/*
This is where the main stuff happens if you couldn't tell from the file name.
I should really clean it up and put the flow logic into functions and then call those functions
in my label statements. it would look neat but is it more efficient and does it help with readability?
*/

require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
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

const {
    ConfigDataMapper,
    ConfigMapper,
} = require('./mapper/config');


const { GithubRepo } = require('./utils/github'); 
const { OnepassBase,OnepassVault } = require('./utils/onepass');
const { SlackActions } = require('./utils/slack');

function calculatePastTime(scope) {
    // Get the current date and time
    let currentDate = new Date();

    // Subtract years, months, and days
    currentDate.setFullYear(currentDate.getFullYear() - scope.year);
    currentDate.setMonth(currentDate.getMonth() - scope.month);
    currentDate.setDate(currentDate.getDate() - scope.day);

    // Handle minutes and hours (including cases where minutes > 60)
    let totalMinutes = currentDate.getMinutes() - scope.minute;
    let hoursToSubtract = scope.hour;

    // If total minutes is negative, adjust hours accordingly
    while (totalMinutes < 0) {
        totalMinutes += 60; // Add 60 minutes for each hour subtracted
        hoursToSubtract += 1; // Increase the hours to subtract since we went below 0 minutes
    }

    // Subtract the calculated hours and set the minutes
    currentDate.setHours(currentDate.getHours() - hoursToSubtract);
    currentDate.setMinutes(totalMinutes);

    // Return the calculated past time in ISO format
    return currentDate.toISOString();
}

(async () => {
    // Github/Onepass call to gather Store Configs, Default Config, and Data Container
    try {
        const apiToken = process.env.PASS_TOKEN;
        var vaultId = "";
        var githubToken = ""

        var onepass = new OnepassVault(apiToken);
        var githubToken = await onepass.grabGithubToken(onepass,vaultId);
        const github = new GithubRepo(githubToken);
        const sandboxList = await github.getSandboxRepo();
        var configList = sandboxList.filter(config => config.name.startsWith("config_")).map(config => config.name);
        var configData = await github.compileConfigData(configList,onepass);
        var defaultConfig = await github.getDefaultConfig();
        var dataContainer = await github.getDataContainer();

    } catch (error) {
        var slack = new SlackActions();
        if (error.response && error.response.status == 401){
            await slack.sendMessage(`Request Failed due to: ${error.message}`);
        }
        console.error(`An error occurred: ${error.message}`);
    }

    // Map each config to correspond with default config
    try {
        var configMapper = new ConfigMapper(defaultConfig,dataContainer,configData)
        var mappedConfigs = await configMapper.mapDefaultAndStoreConfigs();
    } catch (error) {
            console.error(`An error occurred: ${error}`);
    }

    // Main for looping of lists of config data [store1Config,store2Config,store3Config, etc..], commented out temporarily
    for(var c = 0; c < mappedConfigs.length; c++) {
        try {
            var slack = new SlackActions();
            var config = mappedConfigs[c];
            console.log(`Processing config ${c + 1}/${mappedConfigs.length}: ${config.store_name}`);
            // Flag variables, to be cleaned up
            var updateFlag = false;
            var createFlag = false;
            var existingProducts = false;

            // Check active status for data points to sync and set timescopes
            var styleFlag = config.flows_settings.styles.active;
            const styleTimeScope = calculatePastTime(config.flows_settings.styles.scope_from_date);

            var inventoryFlag = config.flows_settings.inventory.active;
            const inventoryTimeScope = calculatePastTime(config.flows_settings.inventory.scope_from_date);

            var imageFlag = config.flows_settings.images.active;
            const imageTimeScope = calculatePastTime(config.flows_settings.images.scope_from_date);

            var orderFlag = config.flows_settings.orders.active;
            const orderTimeScope = calculatePastTime(config.flows_settings.orders.scope_from_date);

            var customerFlag = config.flows_settings.customers.active;
            const customerTimeScope = calculatePastTime(config.flows_settings.customers.scope_from_date);

            // Temporary variables for auth, will create class to call shopify data from 1password
            const storeUrl = config.store_name;
            const shopifyKey = config.tokens.shopify_token;
            const joorToken = config.tokens.apiV2;
            const accountId = config.tokens.account_id;

            

            // Shopify Version
            const shopfiyVersion = config.shopify_api_version;

            // Going to use 1password to gather api creds
            var authData = {
                'client_id': config.tokens.clientId,
                'grant_type': 'password',
                'client_secret': config.tokens.clientSecret,
                'username': config.tokens.joorUsername,
                'password': config.tokens.joorPassword,
            }


            // Product Flow
            productFlow: {
                console.log('\nstoreUrl: ' + storeUrl)
                // Initialize shopify classes
                var shopifyProducts = new ShopifyProducts(shopifyKey, storeUrl, shopfiyVersion);
                var shopfiyCollections = new ShopifyCollections(shopifyKey, storeUrl, shopfiyVersion);
                var shopifyInventory = new ShopifyInventory(shopifyKey, storeUrl, shopfiyVersion);
                var listOfShopifyProducts = await shopifyProducts.getProducts(styleTimeScope);
                if (listOfShopifyProducts.products.length === 0) {
                    console.log('No products to process, moving to customer flow.');
                    break productFlow; // Exit the productFlow block
                }
                var styleDecreaseScope = config.flows_settings.styles.scope_from_date;
                await slack.runningStoreConfig(storeUrl, styleDecreaseScope);
        
                // Initialize joor classes
                const joorProducts = new JoorProducts(authData);
                const joorCollections = new JoorCollections(authData);
                const joorV2Products = new JoorProducts({ token: joorToken }, 'v2');
                
                // Initialize mapper classes
                const mapProductData = new ProductMapper(config);

                // Initialize arrays
                const listOfJoorIds = [];
                const listOfShopifyProdIds = [];
                // Create update and create Arrays
                var productsToUpdate = [];
                var productsToCreate = [];
                var metafieldIdList = [];

                // Initiate joorProduct Auth and call to see if we have products in JOOR
                await joorProducts.authenticate();
                const joorProductsList = await joorProducts.getProducts(accountId);

                // Check if we have joorProducts, if so we mark our existingProducts flag as true
                if(joorProductsList.data.length > 0){
                    existingProducts = true;
                    joorProductsList.data.forEach(joorProduct => {
                        listOfJoorIds.push(joorProduct.product_identifier);
                    })
                }
                console.log('list of joor IDs: ' + listOfJoorIds);
                console.log('existing products? ' + existingProducts);
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
                            listOfShopifyProducts.products.forEach(wholeShopProduct => {
                                if(product.id === wholeShopProduct.id) {
                                    listOfShopifyProdIds.push(product.id.toString())
                                    productsInCollections.push(wholeShopProduct)
                            }
                        })
                        }
                    })
                }

                var updateIds = new Set();  // To keep track of Shopify product IDs that are found in Joor product IDs

                // Iterate over Shopify products
                productsInCollections.forEach(shopifyProduct => {
                    var shopifyProductID = shopifyProduct['id'].toString();
                    // Check if the Shopify product ID exists in the list of Joor product IDs
                    if (listOfJoorIds.includes(shopifyProductID)) {
                        productsToUpdate.push(shopifyProduct);
                        metafieldIdList.push(shopifyProductID) // for our metafield gathering later
                        updateIds.add(shopifyProductID);  // Mark this ID as updated
                    }
                });
                // iterate over Shopify products again to find products to create
                productsInCollections.forEach(shopifyProduct => {
                    var shopifyProductID = shopifyProduct['id'].toString();

                    // If the Shopify product ID was not updated and not in the updateIds set, then it's a product to create
                    if (!updateIds.has(shopifyProductID)) {
                        metafieldIdList.push(shopifyProductID) // for our metafield gathering later
                        productsToCreate.push(shopifyProduct);
                        updateIds.add(shopifyProductID)
                    }
                });
                // If we have products to update, we set our updateFlag to true
                if (productsToUpdate.length > 0) {
                    updateFlag = true;
                }
                if (productsToCreate.length > 0) {
                    createFlag = true;
                }
                // Push metafields into their corresponding product
                // {'product_id': metafieldobjects} -> {'95458234': [{key: custom.wholesale_usd}, 'value': '96.00'},...]}
                var metafieldList = []
                for (var i = 0; i < metafieldIdList.length; i++){
                    var productId = metafieldIdList[i];
                    var productMetafield = await shopifyProducts.getProductMetafields(productId)
                    var processedMetafields = await shopifyProducts.processedProductMetafields(productId,productMetafield)
                    metafieldList.push(processedMetafields)
                }
                if (styleFlag) {
                    // If Store Config Style Flag is true
                    if(updateFlag) {
                        console.log('Updating Styles....')
                        //var metafields = await mapProductData.mapMetafields(shopifyProducts,prodIds);
                        //console.log(metafields);
                        // Map Data to be updated
                        var mappedProductsToUpdate = await mapProductData.mapProductsToUpdate(joorProductsList, productsToUpdate, config);
                        var mappedSkusToUpdate = await mapProductData.mapSkusToUpdate(productsToUpdate, productsInCollections, config);
                        console.log('Amount of Products to Update: ' + mappedProductsToUpdate.length)
                        console.log('Amount of Skus to Update: ' + mappedSkusToUpdate.length)
    
                        // Send Data to be updated
                        var updatedProductsResponse = await joorProducts.postProductsToUpdate(accountId, mappedProductsToUpdate)
                        var updatedSkusResponse = await joorProducts.postSkusToUpdate(accountId, mappedSkusToUpdate)
                    }
                    if(createFlag){
                        console.log('Creating Styles....')
                        // Map Prod Data to be created and send data to be created
                        var mappedProductsToCreate = await mapProductData.mapProductsToCreate(productsToCreate, config, metafieldList);
                        var createdProductsResponse = await joorProducts.postProductsToCreate(accountId, mappedProductsToCreate);
                        console.log('Amount of Products to Create: ' + mappedProductsToCreate.length)

                        console.log('\nCreating Skus....')
                        // Map Sku Data to be created and send data to be created
                        var mappedSkusToCreate = await mapProductData.mapSkusToCreate(createdProductsResponse, productsToCreate, config, metafieldList);
                        var createdSkusResponse = await joorProducts.postSkusToCreate(accountId, mappedSkusToCreate);
                        console.log('Amount of SKUs to Create: ' + mappedSkusToCreate.length)

                        console.log('\nCreating Prices....')
                        // Map Price Data to be created and send data to be created
                        var mappedPrices = await mapProductData.mapPrices(productsToCreate,createdSkusResponse,config, metafieldList);
                        console.log('Amount of SKU Prices to Create: ' + mappedPrices.length)
                        var pricesResponse = await joorProducts.postPrices(accountId, mappedPrices);

                        var mappedInventory = await mapProductData.mapInventory(productsToCreate, config);
                        var inventoryResponse = await joorV2Products.postInventory(mappedInventory)
                    }
                }
            }

            customerFlow: {
                console.log('test customerFlow')
            }

            orderFlow: {
                console.log('test orderFlow')
            }
            
        } catch (e) {
            // something awful happened.
            console.error(`An error occurred: ${e.code}`);
        }
    }
})();



 /*
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