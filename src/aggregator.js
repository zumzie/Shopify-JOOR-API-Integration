class Aggregator {

    async aggregateProducts(rawProducts){
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

    async aggregateCollections(rawProducts){
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
}