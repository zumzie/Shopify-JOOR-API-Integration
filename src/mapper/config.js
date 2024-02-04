class ConfigDataMapper {
    constructor(defaultConfig,dataContainer,configData) {
        this.configData = configData;
        this.defaultConfig = defaultConfig;
        this.dataContainer = dataContainer;
    }
}

class ConfigMapper extends ConfigDataMapper {

    mapConfigsToDataContainers(config) {
        console.log(this.dataContainer)
        return config
    }

    async mapDefaultAndStoreConfigs(){
        var mappedStoreConfigs = [];
        var defaultCustomerValues = this.defaultConfig.flows_settings.customers;
        var defaultStyleValues = this.defaultConfig.flows_settings.styles;
        var defaultImagesValues = this.defaultConfig.flows_settings.images;
        var defaultInventoryValues = this.defaultConfig.flows_settings.styles;
        var defaultOrderValues = this.defaultConfig.flows_settings.orders;

        for(var i = 0; i < this.configData.length; i++){
            var config = this.configData[i];
            var configCustomerValues = config.flows_settings.customers;
            var configStyleValues = config.flows_settings.styles;
            var configImagesValues = config.flows_settings.images;
            var configInventoryValues = config.flows_settings.inventory;
            var configOrderValues = config.flows_settings.orders;
            // map customer values
            for (let key in defaultCustomerValues){
                if(configCustomerValues[key] == "''" || configCustomerValues[key] == "" || !configCustomerValues[key]) {
                    configCustomerValues[key] = defaultCustomerValues[key]
                }
            }
            // map style values
            for (let key in defaultStyleValues){
                if(configStyleValues[key] == "''" || configStyleValues[key] == "" || !configStyleValues[key]) {
                    configStyleValues[key] = defaultStyleValues[key]
                }
            }
            // map image values
            for (let key in defaultImagesValues){
                if(configImagesValues[key] == "''" || configImagesValues[key] == "" || !configImagesValues[key]) {
                    configImagesValues[key] = defaultImagesValues[key]
                }
            }
            // map inventory values
            for (let key in defaultInventoryValues){
                if(configInventoryValues[key] == "''" || configInventoryValues[key] == "" || !configInventoryValues[key]) {
                    configInventoryValues[key] = defaultInventoryValues[key]
                }
            }
            // map order values
            for (let key in defaultOrderValues){
                if(configOrderValues[key] == "''" || configOrderValues[key] == "" || !configOrderValues[key]) {
                    configOrderValues[key] = defaultOrderValues[key]
                }
            }
            
            // Add API version
            config.shopify_api_version = this.defaultConfig.shopify_api_version;
            mappedStoreConfigs.push(config)            
        }
        return mappedStoreConfigs
    }
    async mapConfigs() {
        //console.log(this.configData)
        return this.configData;
    }
}

module.exports = {
    ConfigDataMapper,
    ConfigMapper
};