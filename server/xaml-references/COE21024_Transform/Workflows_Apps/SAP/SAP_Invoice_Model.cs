using SAP_Invoice_Model;
using System;
using System.Collections.Generic;
using System.Data;
using Newtonsoft.Json;

namespace SAP_Invoice_Model
{
    public class SAPInvoice
    {
        [JsonProperty("CompanyCode")]
        public string CompanyCode { get; set; }
        
        [JsonProperty("DocumentDate")]
        public string DocumentDate { get; set; }
        
        [JsonProperty("PostingDate")]
        public string PostingDate { get; set; }
        
        [JsonProperty("Currency")]
        public string Currency { get; set; }
        
        [JsonProperty("Reference")]
        public string Reference { get; set; }
        
        [JsonProperty("OriginalInvNum")]
        public string OriginalInvNum { get; set; }
        
        [JsonProperty("OriginalInvDate")]
        public string OriginalInvDate { get; set; }
        
        [JsonProperty("VendorAccNumber")]
        public string VendorAccNumber { get; set; }
        
        [JsonProperty("VendorDocCurrency")]
        public double VendorDocCurrency { get; set; }
        
        [JsonProperty("PaymentTerms")]
        public string PaymentTerms { get; set; }
        
        [JsonProperty("IMFCode")]
        public string IMFCode { get; set; }
        
        [JsonProperty("_item")]
        public SAPInvoiceItem[] InvoiceItemsArray { get; set; }
        
        public SAPInvoice() {}

        public SAPInvoice(string companyCode, string documentDate, string postingDate, string currency, string reference, 
            string originalInvNum, string originalInvDate, string vendorAccNumber, double VendorDocCurrencyHeader, string paymentTerms, string IMFCode, SAPInvoiceItem[] invoiceItemsArray)
        {
            this.CompanyCode = companyCode;
            this.DocumentDate = documentDate;
            this.PostingDate = postingDate;
            this.Currency = currency;
            this.Reference = reference;
            this.OriginalInvNum = originalInvNum;
            this.OriginalInvDate = originalInvDate;
            this.VendorAccNumber = vendorAccNumber;
            this.VendorDocCurrency = VendorDocCurrencyHeader;
            this.PaymentTerms = paymentTerms;
            this.IMFCode = IMFCode;
            this.InvoiceItemsArray = invoiceItemsArray;
        }
        
        public string SerializeToJSON(bool ignoreNulls)
        {
            var jsonSerializerSettings = new Newtonsoft.Json.JsonSerializerSettings()
            { TypeNameHandling = Newtonsoft.Json.TypeNameHandling.None, NullValueHandling = ignoreNulls ? Newtonsoft.Json.NullValueHandling.Ignore : Newtonsoft.Json.NullValueHandling.Include };
            return Newtonsoft.Json.JsonConvert.SerializeObject(this, Newtonsoft.Json.Formatting.Indented, jsonSerializerSettings);
        }
    }
    
    public class SAPInvoiceItem
    {
        [JsonProperty("CURRENCY")]
        public string Currency { get; set; }
        
        [JsonProperty("SplGlIndicator")]
        public string SplGlIndicator { get; set; }
        
        [JsonProperty("FirstNoteTextLine")]
        public string FirstNoteTextLine { get; set; }
        
        [JsonProperty("GeneralLedger")]
        public string GeneralLedger { get; set; }
        
        [JsonProperty("UnstructureQrCode")]
        public string UnstructureQrCode { get; set; }
        
        [JsonProperty("PeriodStartDate")]
        public string PeriodStartDate { get; set; }
        
        [JsonProperty("PeriodEndDate")]
        public string PeriodEndDate { get; set; }
        
        [JsonProperty("Description")]
        public string Description { get; set; }
        
        [JsonProperty("ItemText")]
        public string ItemText { get; set; }
        
        [JsonProperty("AssetQuan")]
        public double AssetQuan { get; set; }
        
        [JsonProperty("Quantity")]
        public double Quantity { get; set; }
        
        [JsonProperty("BaseUnitMeasure")]
        public string BaseUnitMeasure { get; set; }
        
        [JsonProperty("TaxCode")]
        public string TaxCode { get; set; }
        
        [JsonProperty("TaxAmtDoc")]
        public double TaxAmtDoc { get; set; }
        
        [JsonProperty("GLAmtDocCurrency")]
        public double GLAmtDocCurrency { get; set; }
        
        [JsonProperty("StructureQrCode")]
        public string StructureQrCode { get; set; }
        
        [JsonProperty("CostCenter")]
        public string CostCenter { get; set; }
        
        [JsonProperty("ProjectName")]
        public string ProjectName { get; set; }
        
        [JsonProperty("Leases")]
        public string Leases { get; set; }
        
        [JsonProperty("Location")]
        public string Location { get; set; }
        
        [JsonProperty("WithHoldTaxCode")]
        public string WithHoldTaxCode { get; set; }
        
        [JsonProperty("WithHoldBaseAmt")]
        public double WithHoldBaseAmt { get; set; }
        
        [JsonProperty("WithHoldTaxAmt")]
        public double WithHoldTaxAmt { get; set; }
            
        public SAPInvoiceItem() {}

        public SAPInvoiceItem(string itemCurrency, string splGlIndicator, string firstNoteTextLine, string generalLedger,
            string unstructureQrCode, string periodStartDate, string periodEndDate, string transactionType, string description,
            string itemText, double asset_quan, double quantity, string baseUnitMeasure, string taxCode, double taxAmtDoc, double glAmtDocCurrency,
            string structureQrCode, string costCenter, string orderNumber, string ProjectName, string leases, string location, 
            string WithHoldTaxCode, double WithHoldBaseAmt, double WithHoldTaxAmt)
        {
            this.Currency = itemCurrency;
            this.SplGlIndicator = splGlIndicator;
            this.FirstNoteTextLine = firstNoteTextLine;
            this.GeneralLedger = generalLedger;
            this.UnstructureQrCode = unstructureQrCode;
            this.PeriodStartDate = periodStartDate;
            this.PeriodEndDate = periodEndDate;
            this.Description = description;
            this.ItemText = itemText;
            this.AssetQuan = asset_quan;
            this.Quantity = quantity;
            this.BaseUnitMeasure = baseUnitMeasure;
            this.TaxCode = taxCode;
            this.TaxAmtDoc = taxAmtDoc;
            this.GLAmtDocCurrency = glAmtDocCurrency;
            this.StructureQrCode = structureQrCode;
            this.CostCenter = costCenter;
            this.ProjectName = ProjectName;
            this.Leases = leases;
            this.Location = location;
            this.WithHoldTaxCode = WithHoldTaxCode;
            this.WithHoldBaseAmt = WithHoldBaseAmt;
            this.WithHoldTaxAmt = WithHoldTaxAmt;
        }
    }
   
}


//------------------------------------------------ START SAMPLE SAP CREATE INVOICE REQUEST ------------------------------------------------

//POST https://YOUR_SAP_SERVER.sap.YOUR_DOMAIN.com:44300/sap/opu/odata4/sap/zsb_ptp_iv_api_o4_srv/srvd_a2x/sap/zsd_ptp_iv/0001/ZCDSI_PTP_IV_PV?sap-client=100
//{
      //"CompanyCode" : "1002",
      //"DocumentDate" : "2024-03-09",
      //"PostingDate" : "2024-03-09",
      //"Currency" : "CAD",
      //"Reference" : "1131",
      //"OriginalInvNum" : "",
      //"OriginalInvDate" : "",
      //"VendorAccNumber" : "2000000000",
        //"VendorDocCurrency" : 600,
      //"PaymentTerms" : "",
      //"_item" : [
        //{
          //"CURRENCY" : "EUR",
          //"SplGlIndicator" : "",
          //"FirstNoteTextLine" : "",
          //"GeneralLedger" : "5160451004",
          //"UnstructureQrCode" : "",
          //"PeriodStartDate" : "",
          //"PeriodEndDate" : "",
          //"Description" : "",
          //"ItemText" : "Test",
          //AssetQuan" : 0.000,
          //"Quantity" : 0.000,
          //"BaseUnitMeasure" : "",
          //"TaxCode" : "",
          //"TaxAmtDoc" : 0,
          //"GLAmtDocCurrency" : 100,
          //"StructureQrCode" : "",
          //"CostCenter" : "J005791002",
        //"ProjectName" : "400084",
          //"Leases" : "",
          //"Location" : "Ontario"
        //}]
//}
//------------------------------------------------- END SAMPLE SAP CREATE INVOICE REQUEST -------------------------------------------------