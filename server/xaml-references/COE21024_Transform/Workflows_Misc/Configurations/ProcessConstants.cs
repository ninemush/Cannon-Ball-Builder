using System;

namespace ProcessConstants
{
    public class ProcessOrchestrationConstants
    {
        public string obj_type_invoice { get; set; } = "Coupa vendor invoice";
        public string transaction_name { get; set; } = "Integrate Coupa invoice to SAP";
        public string op_name_dispatch { get; set; } = "Send Coupa vendor invoice for processing";
        public string op_name_check_if_processed { get; set; } = "Check if invoice was already processed";
        public string op_name_transform { get; set; } = "Transform Coupa invoice data for SAP";
        public string op_name_generate_sap_payload { get; set; } = "Generate SAP invoice request payload";
        public string op_name_transform_header_fields { get; set; } = "Transform invoice header fields for SAP";
        public string op_name_truncate_inv_no { get; set; } = "Truncate invoice number to 16 characters";
        public string op_name_truncate_original_inv_no { get; set; } = "Truncate original invoice number to 16 characters";
        public string op_name_check_vendor_acct_no { get; set; } = "Check if vendor account number available in Coupa";
        public string op_name_check_company_code { get; set; } = "Check if company code available in Coupa";
        public string op_name_get_payment_terms { get; set; } = "Retrieve payment terms from mapping";
        public string op_name_post_date_before_cutoff { get; set; } = "Posting date before cut-off date";
        public string op_name_post_date_after_cutoff { get; set; } = "Posting date after cut-off date";       
        
        public string op_name_transform_lines { get; set; } = "Transform invoice lines";
        public string op_name_transform_line_fields { get; set; } = "Transform invoice line fields for SAP";
        public string op_name_li_truncate_description { get; set; } = "Truncate line item description to 50 characters";
        public string op_name_li_truncate_note { get; set; } = "Truncate line item note to 50 characters";
        public string op_name_li_check_aact_details { get; set; } = "Check if account details (cost center, location, GL) available in Coupa";
        public string op_name_li_determine_sp_gl_ind { get; set; } = "Determine SAP special GL indicator based on Coupa prepayment type";
        public string op_name_li_check_tax_details { get; set; } = "Check if tax details available in Coupa";
        public string op_name_li_tax_amt_header { get; set; } = "Set SAP line tax amount based on Coupa header tax details";
        public string op_name_li_tax_amt_line { get; set; } = "Set SAP line tax amount based on Coupa line tax details";  
        
        public string op_name_error_invoice_already_processed { get; set; } = "Coupa invoice already processed";
        public string op_name_error_missing_coupa_supplier { get; set; } = "Coupa supplier number not available";
        public string op_name_error_missing_coupa_company_code { get; set; } = "Coupa company code not available";
        public string op_name_missing_coupa_payment_term { get; set; } = "Coupa payment term not available";
        
        public string op_name_error_li_missing_coupa_account { get; set; } = "Coupa line item account details not available";
        public string op_name_error_li_missing_coupa_cost_center { get; set; } = "Coupa line item cost center not available";
        public string op_name_error_li_missing_coupa_gl { get; set; } = "Coupa line item GL not available";
    }
}