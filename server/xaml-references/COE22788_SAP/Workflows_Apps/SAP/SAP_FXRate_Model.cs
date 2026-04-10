using System;
using System.Collections.Generic;
using System.Data;
using Newtonsoft.Json;
using SAP_FXRate_Model;
using UiPath.CodedWorkflows;
using UiPath.Core;
using UiPath.Core.Activities.Storage;
using UiPath.MicrosoftOffice365.Activities.Api;
using UiPath.Orchestrator.Client.Models;

namespace SAP_FXRate_Model
{
    public class SAPFxRate
    {
        [JsonProperty("ExchangeRateType")]
        public String ExchangeRateType { get; set; }

        [JsonProperty("FromCurrency")]
        public string FromCurrency { get; set; }

        [JsonProperty("ToCurrency")]
        public string ToCurrency { get; set; }

        [JsonProperty("ValidFrom")]
        public string ValidFrom { get; set; }

        [JsonProperty("ExchangeRate")]
        public decimal ExchangeRate { get; set; }
        
        [JsonProperty("FromFactor")]
        public decimal FromFactor { get; set; }
        
        [JsonProperty("ToFactor")]
        public decimal ToFactor { get; set; }
        
        public SAPFxRate()
        {
        }

        public SAPFxRate(String exchangeRateType, string fromCurrency, string toCurrency, DateTime validFrom, decimal exchangeRate, decimal fromFactor, decimal toFactor)
        {
            this.ExchangeRateType = exchangeRateType;
            this.FromCurrency = fromCurrency;
            this.ToCurrency = toCurrency;
            this.ValidFrom = validFrom.ToString("yyyyMMdd");
            this.ExchangeRate = exchangeRate;
            this.FromFactor = fromFactor;
            this.ToFactor = toFactor;
        }

        public string SerializeToJSON(bool ignoreNulls)
        {
            var jsonSerializerSettings = new Newtonsoft.Json.JsonSerializerSettings()
            { TypeNameHandling = Newtonsoft.Json.TypeNameHandling.None, NullValueHandling = ignoreNulls ? Newtonsoft.Json.NullValueHandling.Ignore : Newtonsoft.Json.NullValueHandling.Include };
            return Newtonsoft.Json.JsonConvert.SerializeObject(this, Newtonsoft.Json.Formatting.Indented, jsonSerializerSettings);
        }
    }
}