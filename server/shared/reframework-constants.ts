export const REFRAMEWORK_INFRASTRUCTURE_FILES = new Set([
  "InitAllSettings.xaml",
  "CloseAllApplications.xaml",
  "KillAllProcesses.xaml",
  "Init.xaml",
  "GetTransactionData.xaml",
  "SetTransactionStatus.xaml",
  "InitAllApplications.xaml",
  "RetryCurrentTransaction.xaml",
  "RetryInit.xaml",
]);

export const REFRAMEWORK_INVOKE_TARGETS = [
  "Init.xaml",
  "GetTransactionData.xaml",
  "Process.xaml",
  "SetTransactionStatus.xaml",
];

export const REFRAMEWORK_PATTERN_OPTIONAL_FILES: Record<string, string[]> = {
  dispatcher: [
    "BuildTransactionData.xaml",
    "CleanupAndPrep.xaml",
    "SendNotifications.xaml",
  ],
  performer: [
    "CleanupAndPrep.xaml",
    "SendNotifications.xaml",
  ],
  transformer: [
    "CleanupAndPrep.xaml",
    "SendNotifications.xaml",
  ],
  sync: [
    "CleanupAndPrep.xaml",
    "SendNotifications.xaml",
  ],
};

export const REFRAMEWORK_EXTENDED_FILES = new Set([
  ...REFRAMEWORK_INFRASTRUCTURE_FILES,
  "BuildTransactionData.xaml",
  "CleanupAndPrep.xaml",
  "SendNotifications.xaml",
]);
