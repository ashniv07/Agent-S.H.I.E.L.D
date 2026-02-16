export * from './rules.js';

// High-level policy definitions
export const policies = {
  // Default action policies
  defaultActions: {
    read_file: 'allow_with_monitoring',
    write_file: 'require_approval',
    delete_file: 'require_approval',
    execute_command: 'require_approval',
    network_request: 'allow_with_monitoring',
    database_query: 'allow_with_monitoring',
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
