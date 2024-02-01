function testProductStrucutre(){
    var productStructure = {
        "name": "",
        "external_id": "",
        "product_identifier": "",
        "description": "",
        "order_minimum": 0
    }

    for (var key in productStructure) {
        var value = productStructure[key];
        if (typeof value === 'string') {
            console.log(`${key} is a string`);
        } else if (typeof value === 'number') {
            console.log(`${key} is a number`);
        } else {
            console.log(`${key} is of type ${typeof value}`);
        }
    }
}