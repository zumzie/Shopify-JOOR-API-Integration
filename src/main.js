// I don't go on the dark web and mentally held hostage
// electronic harrassment

require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;

const { Mapper } = require('./mapper.js');
const { Aggregator } = require('./aggregator.js');

const {
    ShopifyGraphQL,
    ShopifyProductsQL,
} = require('./shopifyQL.js');

const {
    ShopifyREST,
    ShopifyProductsREST,
    ShopifyCollectionsREST
} = require('./shopifyREST.js');

async function writeFile(fileName, data) {
    try {
        await fs.writeFile(fileName, JSON.stringify(data, null, 4));
        console.log('Data successfully written');
    } catch (error) {
        console.error(`Error writing to file: ${error.message}`);
    }
}

async function writeCSVFile(fileName, data) {
    const csvWriter = createCsvWriter({
        path: fileName,
        header: Object.keys(data[0]).map(key => ({id: key, title: key}))
    });

    try {
        await csvWriter.writeRecords(data);
        console.log('Data successfully written to CSV');
    } catch (error) {
        console.error(`Error writing to file: ${error.message}`);
    }
}


async function readFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading file:", filePath, error);
        throw error;
    }
}


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
    try {
        // Temporary variables for auth, will create class to call shopify data from 1password
        const storeUrl = process.env.STORE_URL;
        const accessToken = process.env.API_TOKEN;

        // Shopify Version
        const shopifyVersion = process.env.API_VER;

        var shopifyProductsREST = new ShopifyProductsREST(accessToken, storeUrl, shopifyVersion);
        var shopifyCollectionsREST = new ShopifyCollectionsREST(accessToken, storeUrl, shopifyVersion);

        const getProductsIds = await shopifyProductsREST.getProductsIds();
        
        //const test = await readFile('test_folder/products.json');

        const shopProd = await readFile('test_folder/shopify_prod.json');
        
        const sku_test = await readFile('test_folder/skus.json');
        const price_test = await readFile('test_folder/prices.json');
        const get_existing_prods = await readFile('test_folder/existing_prods.json');



        const configFilePath = 'default_config.json';
        const config_file = await readFile(configFilePath)

        const styleTimeScope = calculatePastTime(config_file.flows_settings.styles.scope_from_date);

        var listOfShopifyProducts = await shopifyProductsREST.getProducts(styleTimeScope);

        // Flag statements
        var updateFlag = false;
        var createFlag = false;
        var existingProducts = false;

        console.log(get_existing_prods);

        // Product Flow
        


        // Initialize arrays
        const listOfJoorIds = [];
        const listOfShopifyProdIds = [];

        var productListings = await shopifyCollectionsREST.getCollections();
        var processedListings = await shopifyCollectionsREST.processCollections(productListings);
        var customCollections = await shopifyCollectionsREST.getCustomCollections(processedListings);
        var smartCollections = await shopifyCollectionsREST.getSmartCollections(processedListings);

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
            var data = await shopifyCollectionsREST.getProdCollection(collectionId)
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


        //const aggregatedData = await dataAggregator.aggregateProducts(shopProd);


        //await writeCSVFile('prods.csv', 'test_folder/shopify_prod.json');




        //const mappedProducts = await dataMapper.mapProducts(aggregatedData);
        //const mappedSkus = await dataMapper.mapSkus(aggregatedData);
        //const mappedPrices = await dataMapper.mapPrices(price_test);

    } catch (error) {
        console.error('Error:', error); // Proper error logging
    }
})();
