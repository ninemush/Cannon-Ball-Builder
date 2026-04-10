using System;

namespace ProcessConstants
{
    public class ProcessOrchestrationConstants
    {
        public string obj_type_invoice { get; set; } = "Coupa vendor invoice";
        public string transaction_name { get; set; } = "Integrate Coupa invoice to SAP";
        public string op_name_dispatch { get; set; } = "Send Coupa vendor invoice for processing";
    }
}