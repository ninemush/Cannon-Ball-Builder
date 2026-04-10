using Coupa_Invoice_Model;
using System;
using System.Collections.Generic;
using System.Data;
using Newtonsoft.Json;

namespace Coupa_Invoice_Model
{
    public class CoupaInvoice
    {
        [JsonProperty("id")]
        public string ID { get; set; }

        [JsonProperty("created-at")]
        public string CreatedAt { get; set; }

        [JsonProperty("updated-at")]
        public string UpdatedAt { get; set; }

        [JsonProperty("invoice-date")]
        public string InvoiceDate { get; set; }

        [JsonProperty("invoice-number")]
        public string InvoiceNumber { get; set; }

        [JsonProperty("line-level-taxation")]
        public bool LineLevelTaxation { get; set; }

        [JsonProperty("status")]
        public string Status { get; set; }

        [JsonProperty("total-with-taxes")]
        public double TotalWithTaxes { get; set; }

        [JsonProperty("shipping-amount")]
        public double ShippingAmount { get; set; }
        
        [JsonProperty("gross-total")]
        public double GrossTotal { get; set; }
        
        [JsonProperty("amount-due")]
        public double AmountDue { get; set; }

        [JsonProperty("supplier-total")]
        public double SupplierTotal { get; set; }
        
        [JsonProperty("tax-rate")]
        public double TaxRate { get; set; }

        [JsonProperty("tax-amount")]
        public double TaxAmount { get; set; }

        [JsonProperty("payment-date")]
        public string PaymentDate { get; set; }

        [JsonProperty("payment-notes")]
        public string PaymentNotes { get; set; }

        [JsonProperty("exported")]
        public bool Exported { get; set; }

        [JsonProperty("last-exported-at")]
        public string LastExportedAt { get; set; }

        [JsonProperty("original-invoice-date")]
        public string OriginalInvoiceDate { get; set; }

        [JsonProperty("clearance-document")]
        public string ClearanceDocument { get; set; }

        [JsonProperty("document-type")]
        public string DocumentType { get; set; }

        [JsonProperty("original-invoice-number")]
        public string OriginalInvoiceNumber { get; set; }

        [JsonProperty("is-credit-note")]
        public bool IsCreditNote { get; set; }

        [JsonProperty("line-count")]
        public int LineCount { get; set; }
        
        [JsonProperty("tax-code")]
        public CoupaTaxCode TaxCode { get; set; }
        
        [JsonProperty("custom-fields")]
        public CoupaInvoiceCustomFields CustomFields { get; set; }
        
        [JsonProperty("currency")]
        public CoupaCurrency Currency { get; set; }
        
        [JsonProperty("payment-term")]
        public CoupaPaymentTerm PaymentTerm { get; set; }
        
        [JsonProperty("supplier")]
        public CoupaInvoiceSupplier Supplier { get; set; }
        
        [JsonProperty("invoice-lines")]
        public CoupaInvoiceLine[] InvoiceLinesArray { get; set; }
        
        public CoupaInvoice()
        {
        }

        public CoupaInvoice(string id, string createdAt, string updatedAt, string invoiceDate, 
            string invoiceNumber, bool lineLevelTaxation, string status, double totalWithTaxes, 
            double ShippingAmount, double grossTotal, double AmountDue, double supplierTotal, double taxRate, double taxAmount, string paymentDate, 
            string paymentNotes, bool exported, string lastExportedAt, string originalInvoiceDate, 
            string clearanceDocument, string documentType, string originalInvoiceNumber, bool isCreditNote, int lineCount, 
            CoupaTaxCode taxCode, CoupaInvoiceCustomFields customFields, CoupaCurrency currency, 
            CoupaPaymentTerm paymentTerm, CoupaInvoiceSupplier supplier, CoupaInvoiceLine[] invoiceLinesArray)
        {
            this.ID = id;
            this.CreatedAt = createdAt;
            this.UpdatedAt = updatedAt;
            this.InvoiceDate = invoiceDate;
            this.InvoiceNumber = invoiceNumber;
            this.LineLevelTaxation = lineLevelTaxation;
            this.Status = status;
            this.TotalWithTaxes = totalWithTaxes;
            this.ShippingAmount = ShippingAmount;
            this.GrossTotal = grossTotal;
            this.AmountDue = AmountDue;
            this.SupplierTotal = supplierTotal;
            this.TaxRate = taxRate;
            this.TaxAmount = taxAmount;
            this.PaymentDate = paymentDate;
            this.PaymentNotes = paymentNotes;
            this.Exported = exported;
            this.LastExportedAt = lastExportedAt;
            this.OriginalInvoiceDate = originalInvoiceDate;
            this.ClearanceDocument = clearanceDocument;
            this.DocumentType = documentType;
            this.OriginalInvoiceNumber = originalInvoiceNumber;
            this.IsCreditNote = isCreditNote;
            this.LineCount = lineCount;
            this.TaxCode = taxCode;
            this.CustomFields = customFields;
            this.Currency = currency;
            this.PaymentTerm = paymentTerm;
            this.Supplier = supplier;
            this.InvoiceLinesArray = invoiceLinesArray;
        }
                 
        public string SerializeToJSON(bool ignoreNulls)
        {
            var jsonSerializerSettings = new Newtonsoft.Json.JsonSerializerSettings()
            { TypeNameHandling = Newtonsoft.Json.TypeNameHandling.None, NullValueHandling = ignoreNulls ? Newtonsoft.Json.NullValueHandling.Ignore : Newtonsoft.Json.NullValueHandling.Include };
            return Newtonsoft.Json.JsonConvert.SerializeObject(this, Newtonsoft.Json.Formatting.Indented, jsonSerializerSettings);
        }
    }
     
    public class CoupaInvoiceLine
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("description")]
        public string Description { get; set; }
        
        [JsonProperty("line-num")]
        public string LineNum { get; set; }
        
        [JsonProperty("po-number")]
        public string PONumber { get; set; }
        
        [JsonProperty("order-line-num")]
        public string OrderLineNum { get; set; }
        
        [JsonProperty("quantity")]
        public string Quantity { get; set; }
        
        [JsonProperty("total")]
        public string Total { get; set; }
        
        [JsonProperty("tax-rate")]
        public string TaxRate { get; set; }
        
        [JsonProperty("tax-amount")]
        public string TaxAmount { get; set; }
        
        [JsonProperty("type")]
        public string Type { get; set; }
        
        [JsonProperty("currency")]
        public CoupaCurrency Currency { get; set; }
        
        [JsonProperty("tax-code")]
        public CoupaTaxCode TaxCode { get; set; }
        
        [JsonProperty("custom-fields")]
        public CoupaInvoiceLineCustomFields CustomFields { get; set; }
        
        [JsonProperty("withholding-tax-lines")]
        public CoupaInvoiceLineWithholdingTax[] WithholdingTaxLines { get; set; }
        
        [JsonProperty("commodity")]
        public CoupaCommodity Commodity { get; set; }
        
        [JsonProperty("account")]
        public CoupaAccount Account { get; set; }
            
        public CoupaInvoiceLine() {}

        public CoupaInvoiceLine(string id, string description, string lineNum, string poNumber, string orderLineNum, 
            string quantity, string taxRate, string taxAmount, string type, CoupaCurrency currency, CoupaTaxCode taxCode, 
            CoupaInvoiceLineCustomFields customFields, CoupaInvoiceLineWithholdingTax[] withholdingTaxLines, CoupaCommodity commodity, CoupaAccount account)
        {
            this.ID = id;
            this.Description = description;
            this.LineNum = lineNum;
            this.PONumber = poNumber;
            this.OrderLineNum = orderLineNum;
            this.Quantity = quantity;
            this.TaxRate = taxRate;
            this.TaxAmount = taxAmount;
            this.Type = type;
            this.Currency = currency;
            this.TaxCode = taxCode;
            this.CustomFields = customFields;
            this.WithholdingTaxLines = withholdingTaxLines;
            this.Commodity = commodity;
            this.Account = account;
        }
    }
    
    public class CoupaInvoiceCustomFields
    {
        [JsonProperty("document-date")]
        public string DocumentDate { get; set; }
        
        [JsonProperty("posting-date")]
        public string PostingDate { get; set; 
        }
        [JsonProperty("sap-document-number")]
        public string SAPDocumentNumber { get; set; }
        
        [JsonProperty("imf-code")]
        public CustomFieldsImfCode CFImfCode { get; set; }
               
        public CoupaInvoiceCustomFields() {}

        public CoupaInvoiceCustomFields(string doc_date, string post_date, string sap_doc_number, CustomFieldsImfCode CFImfCode)
        {
            this.DocumentDate = doc_date;
            this.PostingDate = post_date;
            this.SAPDocumentNumber = sap_doc_number;
            this.CFImfCode = CFImfCode;
        }
    }
    
    public class CustomFieldsImfCode
    {
        [JsonProperty("external-ref-num")]
        public string ExternalRefNum { get; set; }
               
        public CustomFieldsImfCode() {}

        public CustomFieldsImfCode(string ExternalRefNum)
        {
            this.ExternalRefNum = ExternalRefNum;
        }
    }
    
    public class CoupaInvoiceLineCustomFields
    {
        [JsonProperty("prepayment-type")]
        public CoupaPrepaymentType PrepaymentType { get; set; }

        [JsonProperty("start-date")]
        public string StartDate { get; set; }
        
        [JsonProperty("end-date")]
        public string EndDate { get; set; }
        
        [JsonProperty("leases")]
        public CoupaLeases Leases { get; set; }
        
        [JsonProperty("project")]
        public CoupaProject Project { get; set; }
               
        public CoupaInvoiceLineCustomFields() {}

        public CoupaInvoiceLineCustomFields(CoupaPrepaymentType prepayment_type, 
            string start_date, string end_date, CoupaLeases leases, CoupaProject project)
        {
            this.PrepaymentType = prepayment_type;
            this.StartDate = start_date;
            this.EndDate = end_date;
            this.Leases = leases;
            this.Project = project;
        }
    }
    
    public class CoupaInvoiceLineWithholdingTax
    {
        [JsonProperty("code")]
        public string Code { get; set; }
        
        [JsonProperty("base")]
        public string Base { get; set; 
        }
        [JsonProperty("withholding-amount")]
        public string WithholdingAmount { get; set; }
               
        public CoupaInvoiceLineWithholdingTax() {}

        public CoupaInvoiceLineWithholdingTax(string code, string Base, string withholding_amount)
        {
            this.Code = code;
            this.Base = Base;
            this.WithholdingAmount = withholding_amount;
        }
    }
    
    public class CoupaEnterprise
    {
        [JsonProperty("code")]
        public string Code { get; set; }
            
        public CoupaEnterprise() {}

        public CoupaEnterprise(string code)
        {
            this.Code = code;
        }
    }
    
    public class CoupaCurrency
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("code")]
        public string Code { get; set; }
            
        public CoupaCurrency() {}

        public CoupaCurrency(string id, string code)
        {
            this.ID = id;
            this.Code = code;
        }
    }
    
    public class CoupaPaymentTerm
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("code")]
        public string Code { get; set; }
        
        [JsonProperty("description")]
        public string Description { get; set; }
            
        public CoupaPaymentTerm() {}

        public CoupaPaymentTerm(string id, string code, string description)
        {
            this.ID = id;
            this.Code = code;
            this.Description = description;
        }
    }
    
    public class CoupaInvoiceSupplier
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("number")]
        public string Number { get; set; }
            
        public CoupaInvoiceSupplier() {}

        public CoupaInvoiceSupplier(string id, string name, string number)
        {
            this.ID = id;
            this.Name = name;
            this.Number = number;
        }
    }
    
    public class CoupaLeases
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("active")]
        public bool Active { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("external-ref-num")]
        public string ExternalRefNum { get; set; }
        
        [JsonProperty("external-ref-code")]
        public string ExternalRefCode { get; set; }
            
        public CoupaLeases() {}

        public CoupaLeases(string id, bool active, string name, string external_ref_num, string external_ref_code)
        {
            this.ID = id;
            this.Active = active;
            this.Name = name;
            this.ExternalRefNum = external_ref_num;
            this.ExternalRefCode = external_ref_code;
        }
    }
    
    public class CoupaPrepaymentType
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("active")]
        public bool Active { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("external-ref-num")]
        public string ExternalRefNum { get; set; }
        
        [JsonProperty("external-ref-code")]
        public string ExternalRefCode { get; set; }
            
        public CoupaPrepaymentType() {}

        public CoupaPrepaymentType(string id, bool active, string name, string external_ref_num, string external_ref_code)
        {
            this.ID = id;
            this.Active = active;
            this.Name = name;
            this.ExternalRefNum = external_ref_num;
            this.ExternalRefCode = external_ref_code;
        }
    }
    
    public class CoupaProject
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("active")]
        public bool Active { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("external-ref-num")]
        public string ExternalRefNum { get; set; }
        
        [JsonProperty("external-ref-code")]
        public string ExternalRefCode { get; set; }
            
        public CoupaProject() {}

        public CoupaProject(string id, bool active, string name, string external_ref_num, string external_ref_code)
        {
            this.ID = id;
            this.Active = active;
            this.Name = name;
            this.ExternalRefNum = external_ref_num;
            this.ExternalRefCode = external_ref_code;
        }
    }

    public class CoupaTaxCode
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("code")]
        public string Code { get; set; }
        
        [JsonProperty("percentage")]
        public string Percentage { get; set; }
        
        [JsonProperty("description")]
        public string Description { get; set; }
            
        public CoupaTaxCode() {}

        public CoupaTaxCode(string id, string code, string percentage, string description)
        {
            this.ID = id;
            this.Code = code;
            this.Percentage = percentage;
            this.Description = description;
        }
    }
    
    public class CoupaCommodity
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("category")]
        public string Category { get; set; }
        
        [JsonProperty("subcategory")]
        public string Subcategory { get; set; }
            
        public CoupaCommodity() {}

        public CoupaCommodity(string id, string name, string category, string subcategory)
        {
            this.ID = id;
            this.Name = name;
            this.Category = category;
            this.Subcategory = subcategory;
        }
    }
    
    public class CoupaGL
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("active")]
        public bool Active { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("external-ref-num")]
        public string ExternalRefNum { get; set; }
        
        [JsonProperty("external-ref-code")]
        public string ExternalRefCode { get; set; }
            
        public CoupaGL() {}

        public CoupaGL(string id, bool active, string name, string external_ref_num, string external_ref_code)
        {
            this.ID = id;
            this.Active = active;
            this.Name = name;
            this.ExternalRefNum = external_ref_num;
            this.ExternalRefCode = external_ref_code;
        }
    }
    
    public class CoupaAccount
    {
        [JsonProperty("id")]
        public string ID { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("code")]
        public string Code { get; set; }
        
        [JsonProperty("active")]
        public bool Active { get; set; }
        
        [JsonProperty("account-type-id")]
        public string AccountTypeID { get; set; }
        
        [JsonProperty("segment-1")]
        public string Segment1 { get; set; }
        
        [JsonProperty("segment-2")]
        public string Segment2 { get; set; }
        
        [JsonProperty("segment-3")]
        public string Segment3 { get; set; }
        
        [JsonProperty("segment-4")]
        public string Segment4 { get; set; }
        
            
        public CoupaAccount() {}

        public CoupaAccount(string id, string name, string code, bool active, string acct_type_id, 
            string segment_1, string segment_2, string segment_3, string segment_4)
        {
            this.ID = id;
            this.Name= name;
            this.Code = code;
            this.Active = active;
            this.AccountTypeID = acct_type_id;
            this.Segment1 = segment_1;
            this.Segment2 = segment_2;
            this.Segment3 = segment_3;
            this.Segment4 = segment_4;
        }
    }
}


//------------------------------------------------ START EXAMPLE COUPA INVOICE RESPONSE ------------------------------------------------

//GET https://YOUR_COUPA_INSTANCE.api.coupahost.com/api/invoices?format=json&exported=false&status=approved&invoice-lines[account][account-type][enterprise][code]=SAP

//ONLY KEPT FELDS OF INTEREST TO THIS INTEGRATION
  //{
        //"id": 92010,
        //"created-at": "2024-04-01T02:16:48+03:00",
        //"updated-at": "2024-04-01T02:19:09+03:00",
        //"invoice-date": "2024-04-01T00:00:00+03:00",
        //"invoice-number": "Test 10",
        //"line-level-taxation": false,
        //"status": "approved",
        //"total-with-taxes": "100.00",
        //"gross-total": "100.00",
        //"supplier-total": "100.00",
        //tax-code": {
            //"id": 1,
            //"code": "test",
            //"percentage": 0.0,
            //"description": "Zero rated sales"
        //},
        //"tax-rate": null,
        //"tax-amount": "0.00",
        //"payment-date": null,
        //"payment-notes": null,
        //"exported": false,
        //"last-exported-at": null,
        //"original-invoice-date": null,
        //"clearance-document": null,
        //"document-type": "Invoice",
        //"original-invoice-number": null,
        //"is-credit-note": false,
        //"line-count": 1,
        //"custom-fields": {
            //"document-date": "",
            //"posting-date": "",
            //"sap-document-number": ""
        //},
        //"currency": {
            //"id": 1,
            //"code": "USD",
        //},
        //"payment-term": {
            //"id": 2,
            //"code": "10 Days Net",
            //"description": "10",
        //},
        //"supplier": {
            //"id": 8819,
            //"name": "SAP Test Case - Leases",
            //"number": null,
        //},
        //"invoice-lines": [
            //{
                //"id": 350285,
                //"description": "Test",
                //"line-num": 1,
                //"po-number": null,
                //"order-line-num": null,
                //"quantity": null,
                //"tax-rate": null,
                //"tax-amount": "0.00",
                //"total": "100.00",
                //"type": "InvoiceAmountLine",
                //tax-code": {
                    //"id": 1,
                    //"code": "test",
                    //"percentage": 0.0,
                    //"description": "Zero rated sales"
                //},
                //"custom-fields": {
                    //"prepayment-type": {
                        //"id": 1612,
                        //"active": true,
                        //"name": "Prepaid Other",
                        //"external-ref-num": "22236",
                        //"external-ref-code": "22236"
                    //}
                    //"project": "",
                    //"start-date": "",------------------------------> ???
                    //"end-date": "",------------------------------> ???
                    //"leases": {
                        //"id": 9488,
                        //"active": true,
                        //"name": "EMEA-FRN-PAR-CW-06.1",
                        //"external-ref-num": "205",
                        //"external-ref-code": "205"
                    //}
                //},
                //"commodity": {
                    //"id": 405,,
                    //"name": "Lease Short Term (max 12mths)",
                    //"category": "services",
                    //"subcategory": "",
                    //"custom-fields": {
                        //"gl": {
                            //"id": 15245,
                            //"active": true,
                            //"name": "ST Leases (NetLease)",
                            //"external-ref-num": "143703",
                            //"external-ref-code": "143703"
                        //},
                        //"gl-sap": {
                            //"id": 19326,
                            //"active": true,
                            //"name": "Clearing account: Real Estate",
                            //"external-ref-num": "2030020040",
                            //"external-ref-code": "2030020040" 
                        //}
                    //},
                //"account": {
                    //"id": 23586,
                    //"name": "YOUR_COMPANY_NAME-Advances to suppliers-YOUR_LOCATION",
                    //"code": "3004-T006493004-1072033010-1",
                    //"active": true,
                    //"account-type-id": 54,
                    //"segment-1": "3004",
                    //"segment-2": "T006493004",
                    //"segment-3": "1072033010",
                    //"segment-4": "1"
                //}
            //}
        //]
    //}

//------------------------------------------------- END EXAMPLE COUPA INVOICE RESPONSE -------------------------------------------------