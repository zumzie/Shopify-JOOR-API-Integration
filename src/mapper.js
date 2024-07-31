require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;


class Mapper {

        async mapProducts(rawProducts){
            try {
                var mappedProducts = [];

                rawProducts.forEach(prod => {
                    var prodObj = {};
                    prodObj['id'] = prod.id;
                    prodObj['name'] = prod.name;
                    prodObj['product_identifier'] = prod.product_identifier;

                    mappedProducts.push(prodObj);
                });

                return mappedProducts;
            } catch (e) {
                console.log(e);
            }
        }

        async mapSkus(rawSkus){
            try {
                var skuProducts = [];

                rawSkus.forEach(skus => {
                    var skusObj = {};
                    skusObj['id'] = skus.id;
                    skusObj['external_id'] = skus.external_id;
                    skusObj['sku_identifier'] = skus.sku_identifier;

                    skuProducts.push(skusObj);
                });

                return skuProducts;
            } catch (e) {
                console.log(e);
            }
        }

        async mapPrices(rawPrices){
            try {
                var priceObjList = [];

                rawPrices.forEach(skuPrices => {
                    var pricesObj = {};
                    pricesObj['sku_id'] = skuPrices.sku_id;
                    pricesObj['wholesale_value'] = skuPrices.wholesale_value;
                    pricesObj['retail_value'] = skuPrices.retail_value;

                    priceObjList.push(pricesObj);
                });

                return priceObjList;
            } catch (e) {
                console.log(e);
            }
        }
        
};

module.exports = { Mapper };