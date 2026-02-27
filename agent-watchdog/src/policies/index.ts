export * from './rules.js';

// High-level policy definitions
export const policies = {
  // Default action policies
  defaultActions: {
    // File system
    read_file:       'allow_with_monitoring',
    write_file:      'require_approval',
    delete_file:     'require_approval',
    access_file:     'allow_with_monitoring',
    download_file:   'require_approval',
    upload_file:     'require_approval',
    // Execution
    execute_command: 'require_approval',
    // Network / communication
    network_request: 'allow_with_monitoring',
    send_email:      'require_approval',
    send_message:    'require_approval',
    make_request:    'allow_with_monitoring',
    // Data
    database_query:  'allow_with_monitoring',
    read_database:   'allow_with_monitoring',
    write_database:  'require_approval',
    // Document / reporting
    read_document:   'allow_with_monitoring',
    write_document:  'require_approval',
    create_report:   'allow_with_monitoring',
    // Calendar / scheduling
    create_event:    'allow_with_monitoring',
    read_calendar:   'allow_with_monitoring',
    // Generic
    search:          'allow_with_monitoring',
    lookup:          'allow_with_monitoring',
    query:           'allow_with_monitoring',
  } as const,

  // Sensitive paths that require extra scrutiny
  sensitivePaths: [
    '/etc/',
    '/root/',
    '/var/log/',
    '.env',
    '.ssh/',
    'credentials',
    'secrets',
    'private',
    'config/',
  ],

  // Actions that always trigger review
  highRiskActions: [
    'delete',
    'remove',
    'drop',
    'truncate',
    'execute',
    'eval',
    'sudo',
    'chmod',
    'chown',
  ],

  // Maximum risk scores for auto-approval
  autoApprovalThreshold: 30,
  flagThreshold: 70,
  killThreshold: 90,
};
