using UiPath.CodedWorkflows;
using System;

namespace COE22788_FXRates_SAP_Perform
{
    public class ExcelFactory
    {
        public UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection ExcelConnection1 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection ExcelConnection2 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection ExcelConnection3 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection ExcelConnection4 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection ExcelConnection5 { get; set; }

        public ExcelFactory(ICodedWorkflowsServiceContainer resolver)
        {
            ExcelConnection1 = new UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection("{{Excel_Connection_1}}", resolver);
            ExcelConnection2 = new UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection("{{Excel_Connection_2}}", resolver);
            ExcelConnection3 = new UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection("{{Excel_Connection_3}}", resolver);
            ExcelConnection4 = new UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection("{{Excel_Connection_4}}", resolver);
            ExcelConnection5 = new UiPath.MicrosoftOffice365.Activities.Api.ExcelConnection("{{Excel_Connection_5}}", resolver);
        }
    }

    public class O365MailFactory
    {
        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection1 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection2 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection3 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection4 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection5 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection6 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection7 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection8 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.MailConnection MailConnection9 { get; set; }

        public O365MailFactory(ICodedWorkflowsServiceContainer resolver)
        {
            MailConnection1 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_1}}", resolver);
            MailConnection2 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_2}}", resolver);
            MailConnection3 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_3}}", resolver);
            MailConnection4 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_4}}", resolver);
            MailConnection5 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_5}}", resolver);
            MailConnection6 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_6}}", resolver);
            MailConnection7 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_7}}", resolver);
            MailConnection8 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_8}}", resolver);
            MailConnection9 = new UiPath.MicrosoftOffice365.Activities.Api.MailConnection("{{Mail_Connection_9}}", resolver);
        }
    }

    public class OneDriveFactory
    {
        public UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection OneDriveConnection1 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection OneDriveConnection2 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection OneDriveConnection3 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection OneDriveConnection4 { get; set; }

        public UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection OneDriveConnection5 { get; set; }

        public OneDriveFactory(ICodedWorkflowsServiceContainer resolver)
        {
            OneDriveConnection1 = new UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection("{{OneDrive_Connection_1}}", resolver);
            OneDriveConnection2 = new UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection("{{OneDrive_Connection_2}}", resolver);
            OneDriveConnection3 = new UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection("{{OneDrive_Connection_3}}", resolver);
            OneDriveConnection4 = new UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection("{{OneDrive_Connection_4}}", resolver);
            OneDriveConnection5 = new UiPath.MicrosoftOffice365.Activities.Api.OneDriveConnection("{{OneDrive_Connection_5}}", resolver);
        }
    }
}
