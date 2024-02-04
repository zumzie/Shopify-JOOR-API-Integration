require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const { SlackActions } = require('../utils/slack');

class DataMapper {
    constructor(configData) {
        this.configData = configData;
        var slack = new SlackActions();
    }

}

class ProductMapper extends DataMapper {
    optionMapper(cur_product, colorOptionValue, sizeOptionValue, materialOptionValue, fabricOptionValue) {
        try {

            // Create empty key/value pair to be assigend from our option settings in our default config
            var option_settings = {};
            option_settings[colorOptionValue] = '';
            option_settings[sizeOptionValue] = '';
            option_settings[materialOptionValue] = '';
            option_settings[fabricOptionValue] = '';

            // Create empty key/value pair to be assigned from shopify options. shopify has a list that contains each unique option such as size/value.
            // This is useful to also grab the index and use for order_nbr
            var option_values = {};
            option_values[colorOptionValue] = '';
            option_values[sizeOptionValue] = '';
            option_values[materialOptionValue] = '';
            option_values[fabricOptionValue] = '';
            
            // Loop through our options in shopify product
            for (var i = 0; i < cur_product['options'].length; i++) {
                var productOption = cur_product['options'][i];

                // Check if option value exists such as Color/Size/Material/Fabric
                Object.keys(option_settings).forEach(option => {
                    if (productOption.name === option) {
                        // Update the corresponding value in option_settings
                        option_settings[option] = 'option'+productOption.position.toString();
                        option_values[option] = productOption.values
                    }
                });
            }
            return { option_settings, option_values };;
        } catch (parseErr) {
            console.error("Error parsing JSON:", parseErr);
        }
    }

    
    async mapProductsToCreate(productsToCreate, configData, metafieldData){
        const getProductMetafieldValueByName = (product_id, metafield_name) => {
            // Split the metafield_name if it's in 'namespace.key' format to get the actual key
            metafield_name = metafield_name.includes('.') ? metafield_name.split('.')[1] : metafield_name;
        
            let result = "";
        
            // Iterate over the metafieldData array
            for (const metafieldGroup of metafieldData) {
                // Check if the current group's product ID matches the one we're looking for
                if (metafieldGroup[product_id]) {
                    // Find the metafield with the matching key
                    const metafield = metafieldGroup[product_id].find(meta => meta.key.toLowerCase() === metafield_name.toLowerCase());
                    if (metafield) {
                        // If found, assign the value to result and break the loop
                        result = metafield.value;
                        break; // Exit the loop since we found our value
                    }
                }
            }
        
            return result;
        };
        var productStructure = {
            "name": "",
            "external_id": "",
            "product_identifier": "",
            "description": "",
            "order_minimum": 0
        }
        var productList = []

        // Assign config variables to be evaled
        var styleConfigData = configData.flows_settings.styles
        var eval_style_number = styleConfigData.eval_style_number
        var eval_style_name = styleConfigData.eval_style_name
        var eval_style_description = styleConfigData.eval_style_description
        try {
            if (productsToCreate) {
                productsToCreate.forEach(cur_product => {
                    // Create a new object for each product based on the structure
                    let mappedProduct = { ...productStructure };
                    var cur_variant = cur_product['variants'][0]; // allows for style number manipulation
                    // Map properties from the product to the new object
                    mappedProduct.name = eval(eval_style_name); // Example mapping
                    mappedProduct.external_id = eval(eval_style_number);
                    mappedProduct.description = eval(eval_style_description);
                    mappedProduct.product_identifier = cur_product.id.toString();
                    
                    // Add the mapped product to the productList
                    productList.push(mappedProduct);
                    //console.log(getProductMetafieldValueByName(cur_product.id.toString(), 'wholesaleusd'))
                });
            }
        } catch (parseErr) {
            await slack.sendMessage(`:shopify: :: \`${configData.store_name}\`@ _apisandbox.jooraccess.com_ => :alphabet-white-exclamation: => Error occuring in function mapProductsToCreate: ${parseErr}`);
            console.error("Error parsing JSON:", parseErr);
        }
        return productList;
    }

    async mapProductsToUpdate(joorProductData, shopifyProductData, configData){
        var productStructure = {
                "id": "",
                "name": "",
                "description": "",
        }
        var productsToUpdateList = []
        var styleConfigData = configData.flows_settings.styles
        var eval_style_name = styleConfigData.eval_style_name
        var eval_style_description = styleConfigData.eval_style_description
        try {
            for(var i = 0; i < shopifyProductData.length; i++) {
                var cur_product = shopifyProductData[i]
                joorProductData.data.forEach(joorProduct => {
                    if(cur_product['id'].toString() == joorProduct.product_identifier){
                        let mappedProduct = { ...productStructure };
                        // Map properties from the product to the new object
                        mappedProduct.id = joorProduct.id;
                        mappedProduct.name = eval(eval_style_name); // Example mapping
                        mappedProduct.description = eval(eval_style_description);
                        productsToUpdateList.push(mappedProduct);
                    }
                })
            }
        } catch (parseErr) {
            //var slack = new SlackActions();
            await slack.sendMessage(`:shopify: :: \`${configData.store_name}\`@ _apisandbox.jooraccess.com_ => :alphabet-white-exclamation: => Error occuring in function mapProductsToUpdate: ${parseErr}`);
            console.error("Error parsing JSON:", parseErr);
        }
    
        return productsToUpdateList;
    }

    async mapSkusToUpdate(productsToUpdate, productData, configData) {
        var skuStructure = {
            "external_id": "",
            "sku_identifier": "",
            "trait_values": []
        };
    
        var colorOptionValue = configData.options_settings.color;
        var sizeOptionValue = configData.options_settings.size;
        var materialOptionValue = configData.options_settings.materials;
        var fabricOptionValue = configData.options_settings.fabrication;
        var unique_options = configData.options_settings.unique_options;
        var eval_style_upc = configData.flows_settings.styles.eval_upc;
            
        try {
            var finalProductList = []; // This will store each product with its SKUs
    
            for (var i = 0; i < productsToUpdate.length; i++) {
                var cur_product = productsToUpdate[i];
                var { option_settings, option_values } = this.optionMapper(cur_product, colorOptionValue, sizeOptionValue, materialOptionValue, fabricOptionValue);
                var color = option_settings['Color'];
                var size = option_settings['Size'];
                var colorList = option_values['Color'];
                var sizeList = option_values['Size'];
                var productSkus = []; // Temporary array to store SKUs of the current product
                for (var k = 0; k < cur_product['variants'].length; k++) {
                    // Create Sku
                    var cur_variant = cur_product['variants'][k];
                    var upc = eval(eval_style_upc)
                    let mappedSkus = { ...skuStructure };
                    mappedSkus.external_id = cur_variant['id'].toString();
                    mappedSkus.sku_identifier = cur_variant['sku'] || cur_variant['id'].toString();
                    // Trait values
                    mappedSkus.trait_values = [
                        {
                            "trait_name": "Color",
                            "value": cur_variant[color] || eval(unique_options['color']),
                            "external_id": cur_variant[color] || eval(unique_options['color_code']),
                            "order_nbr": colorList.indexOf(cur_variant[color]) + 1 || 1
                        },
                        {
                            "trait_name": "Size",
                            "value": cur_variant[size] || eval(unique_options['size']),
                            "external_id": cur_variant[size] || eval(unique_options['size_code']),
                            "order_nbr": sizeList.indexOf(cur_variant[size]) + 1 || 1
                        }
                    ];
                        mappedSkus.identifiers = [{'type': 'upc','value': upc+'::'+cur_variant['id']}];
                        productSkus.push(mappedSkus);
                    }
                    // Add the current product and its SKUs to the final list
                if (productSkus.length > 0) {
                        finalProductList.push({
                            "product_id": cur_product['id'],
                            "skus": productSkus
                    });
                }
            }
            return finalProductList;
        } catch (parseErr) {
            //var slack = new SlackActions();
            await slack.sendMessage(`:shopify: :: \`${configData.store_name}\`@ _apisandbox.jooraccess.com_ => :alphabet-white-exclamation: => Error occuring in function mapSkusToUpdate: ${parseErr}`);
            console.error("Error parsing JSON:", parseErr);
        }
        return finalProductList;
    }

    async mapSkusToCreate(productResponse, productsToCreate, configData) {
        const getProductMetafieldValueByName = (product_id, metafield_name) => {
            // Split the metafield_name if it's in 'namespace.key' format to get the actual key
            metafield_name = metafield_name.includes('.') ? metafield_name.split('.')[1] : metafield_name;
        
            let result = "";
        
            // Iterate over the metafieldData array
            for (const metafieldGroup of metafieldData) {
                // Check if the current group's product ID matches the one we're looking for
                if (metafieldGroup[product_id]) {
                    // Find the metafield with the matching key
                    const metafield = metafieldGroup[product_id].find(meta => meta.key.toLowerCase() === metafield_name.toLowerCase());
                    if (metafield) {
                        // If found, assign the value to result and break the loop
                        result = metafield.value;
                        break; // Exit the loop since we found our value
                    }
                }
            }
        
            return result;
        };
        var skuStructure = {
            "product_id": "",
            "external_id": "",
            "sku_identifier": "",
            "trait_values": []
        };
    
        var colorOptionValue = configData.options_settings.color;
        var sizeOptionValue = configData.options_settings.size;
        var materialOptionValue = configData.options_settings.materials;
        var fabricOptionValue = configData.options_settings.fabrication;
        var unique_options = configData.options_settings.unique_options;
        var eval_style_upc = configData.flows_settings.styles.eval_upc;
    
        try {
            var finalProductList = []; // This will store each product with its SKUs
    
            if (productResponse['data'] && productsToCreate) {
                for (var i = 0; i < productsToCreate.length; i++) {
                    var cur_product = productsToCreate[i];
                    var { option_settings, option_values } = this.optionMapper(cur_product, colorOptionValue, sizeOptionValue, materialOptionValue, fabricOptionValue);
                    var color = option_settings['Color'];
                    var size = option_settings['Size'];
                    var colorList = option_values['Color'];
                    var sizeList = option_values['Size'];
    
                    var productSkus = []; // Temporary array to store SKUs of the current product
                    
                    // Loop through our created products response data to gather id
                    for (var j = 0; j < productResponse['data'].length; j++) {
                        var postedProduct = productResponse['data'][j];

                        // does our product form our response data match with our product in shopify?
                        if (postedProduct['product_identifier'] == cur_product['id']) {
                            for (var k = 0; k < cur_product['variants'].length; k++) {
                                // Create Sku
                                var cur_variant = cur_product['variants'][k];
                                var upc = eval(eval_style_upc)
                                let mappedSkus = { ...skuStructure };
                                mappedSkus.product_id = postedProduct['id'];
                                mappedSkus.external_id = cur_variant['id'].toString();
                                mappedSkus.sku_identifier = cur_variant['sku'] || cur_variant['id'].toString();
    
                                // Trait values
                                mappedSkus.trait_values = [
                                    {
                                        "trait_name": "Color",
                                        "value": cur_variant[color] || eval(unique_options['color']),
                                        "external_id": cur_variant[color] || eval(unique_options['color_code']),
                                        "order_nbr": colorList.indexOf(cur_variant[color]) + 1 || 1
                                    },
                                    {
                                        "trait_name": "Size",
                                        "value": cur_variant[size] || eval(unique_options['size']),
                                        "external_id": cur_variant[size] || eval(unique_options['size_code']),
                                        "order_nbr": sizeList.indexOf(cur_variant[size]) + 1 || 1
                                    }
                                ];
                                mappedSkus.identifiers = [{'type': 'upc','value': upc+'::'+cur_variant['id']}];
                                productSkus.push(mappedSkus);
                            }
                        }
                    }
                    // Add the current product and its SKUs to the final list
                    if (productSkus.length > 0) {
                        finalProductList.push({
                            "product_id": cur_product['id'],
                            "skus": productSkus
                        });
                    }
                }
            }
            return finalProductList;
        } catch (parseErr) {
            //var slack = new SlackActions();
            await slack.sendMessage(`:shopify: :: \`${configData.store_name}\`@ _apisandbox.jooraccess.com_ => :alphabet-white-exclamation: => Error occuring in function mapSkusToCreate: ${parseErr}`);
            console.error("Error parsing JSON:", parseErr);
        }
    }

    async mapPrices(productData, skuResponse, configData, metafieldData) {
        const getProductMetafieldValueByName = (product_id, metafield_name) => {
            // Split the metafield_name if it's in 'namespace.key' format to get the actual key
            metafield_name = metafield_name.includes('.') ? metafield_name.split('.')[1] : metafield_name;
        
            let result = "";
        
            // Iterate over the metafieldData array
            for (const metafieldGroup of metafieldData) {
                // Check if the current group's product ID matches the one we're looking for
                if (metafieldGroup[product_id]) {
                    // Find the metafield with the matching key
                    const metafield = metafieldGroup[product_id].find(meta => meta.key.toLowerCase() === metafield_name.toLowerCase());
                    if (metafield) {
                        // If found, assign the value to result and break the loop
                        result = metafield.value;
                        break; // Exit the loop since we found our value
                    }
                }
            }
        
            return result;
        };
        var priceStructure = {
            "sku_id": '',
            "price_type_name": '',
            "price_type_currency_code": '',
            "wholesale_value": '',
            "retail_value": ''
        };
        var pricesList = []; // Store all price structures
        var eval_unit_price = configData.flows_settings.styles.eval_unit_price;
        var eval_unit_retail_price = configData.flows_settings.styles.eval_unit_retail_price;
    
        try {
            // Loop through Shopify product data
            for (var i = 0; i < productData.length; i++) {
                var cur_product = productData[i];
                var prodId = cur_product['id'].toString();

                // Loop through response data from created Skus
                for (var j = 0; j < skuResponse.length; j++) {
                    var skuData = skuResponse[j];
                    if (skuData && skuData.hasOwnProperty(prodId)) {
                        var groupedSkus = skuData[prodId];
    
                        // Process each SKU in groupedSkus to create price structures
                        groupedSkus.forEach(sku => {
                            var priceData = {...priceStructure}; // Clone the structure for each SKU
                            cur_product['variants'].forEach(cur_variant => {
                                if((sku.sku_identifier === cur_variant['sku']) || (sku.sku_identifier === cur_variant['id'].toString())){
                                    console.log(eval(eval_unit_price))
                                    priceData.sku_id = sku.id;
                                    priceData.price_type_name = 'USD';
                                    priceData.price_type_currency_code = 'USD';
                                    priceData.wholesale_value = eval(eval_unit_price).toString();
                                    priceData.retail_value = eval(eval_unit_retail_price).toString();
                                    pricesList.push(priceData);
                                }
                            })
                        });
                    }
                }
            }
            return pricesList;
        } catch (parseErr) {
            //var slack = new SlackActions();
            await slack.sendMessage(`:shopify: :: \`${configData.store_name}\`@ _apisandbox.jooraccess.com_ => :alphabet-white-exclamation: => Error occuring in function mapPrices: ${parseErr}`);
            console.error("Error parsing JSON:", parseErr);
        }
    }

    async mapImages(productData, skuResponse, configData) {
        var priceStructure = {
            "sku_id": '',
            "price_type_name": '',
            "price_type_currency_code": '',
            "wholesale_value": '',
            "retail_value": ''
        };
        var imageList = []; // Store all image objects
    
        try {
            
        } catch (parseErr) {
            console.error("Error parsing JSON:", parseErr);
        }
    }

    async mapInventory(productData, configData) {
        var priceStructure = {
            "warehouse": "Default",
            "inventory_date": "IMMEDIATE",
            "upc": "",
            "inventory": ""
        }
        var inventoryList = {"inventory_items": []}; // Store all inventory objects
        var eval_style_upc = configData.flows_settings.styles.eval_upc;

    
        try {
            productData.forEach(cur_product => {
                cur_product['variants'].forEach(cur_variant => {
                    var inventoryData = {...priceStructure};
                    var upc = eval(eval_style_upc)
                    inventoryData.upc = upc+'::'+cur_variant['id'].toString()
                    inventoryData.inventory = cur_variant['inventory_quantity']
                    inventoryList.inventory_items.push(inventoryData)
                })
            })
            return inventoryList;
        } catch (parseErr) {
            //var slack = new SlackActions();
            await slack.sendMessage(`:shopify: :: \`${configData.store_name}\`@ _apisandbox.jooraccess.com_ => :alphabet-white-exclamation: => Error occuring in function mapInventory: ${parseErr}`);
            console.error("Error parsing JSON:", parseErr);
        }
    }
};


// Export all classes
module.exports = {
    ProductMapper
};