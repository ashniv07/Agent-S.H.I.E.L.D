// Policy rules for violation detection

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  category: 'data_access' | 'system_access' | 'network' | 'pii' | 'authorization';
  patterns: RegExp[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export const policyRules: PolicyRule[] = [
  // System access violations
  {
    id: 'sys-001',
    name: 'Sensitive System File Access',
    description: 'Attempt to access sensitive system files',
    category: 'system_access',
    patterns: [
      /\/etc\/passwd/i,
      /\/etc\/shadow/i,
      /\/etc\/sudoers/i,
      /\/root\//i,
      /\.ssh\//i,
      /\.gnupg\//i,
      /\/proc\/\d+/i,
    ],
    severity: 'CRITICAL',
  },
  {
    id: 'sys-002',
    name: 'Environment Variable Access',
    description: 'Attempt to access environment variables or secrets',
    category: 'system_access',
    patterns: [
      /\.env/i,
      /secrets?\.(json|yaml|yml|txt)/i,
      /credentials?\.(json|yaml|yml|txt)/i,
      /api[_-]?key/i,
      /process\.env/i,
    ],
    severity: 'HIGH',
  },
  {
    id: 'sys-003',
    name: 'System Command Execution',
    description: 'Attempt to execute system commands',
    category: 'system_access',
    patterns: [
      /exec\s*\(/i,
      /spawn\s*\(/i,
      /system\s*\(/i,
      /eval\s*\(/i,
      /child_process/i,
      /\$\(.*\)/,
      /`.*`/,
    ],
    severity: 'CRITICAL',
  },

  // PII violations
  {
    id: 'pii-001',
    name: 'Social Security Number',
    description: 'Potential SSN pattern detected',
    category: 'pii',
    patterns: [/\b\d{3}-\d{2}-\d{4}\b/, /\bssn\b/i],
    severity: 'CRITICAL',
  },
  {
    id: 'pii-002',
    name: 'Credit Card Number',
    description: 'Potential credit card pattern detected',
    category: 'pii',
    patterns: [
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/,
      /\bcredit[_-]?card\b/i,
      /\bcc[_-]?number\b/i,
    ],
    severity: 'CRITICAL',
  },
  {
    id: 'pii-003',
    name: 'Email Address Bulk Access',
    description: 'Bulk email address access pattern',
    category: 'pii',
    patterns: [/emails?\s*\[/i, /user[_-]?emails?/i, /bulk[_-]?email/i],
    severity: 'HIGH',
  },

  // Data access violations
  {
    id: 'data-001',
    name: 'Database Direct Access',
    description: 'Direct database access attempt',
    category: 'data_access',
    patterns: [
      /DROP\s+(TABLE|DATABASE)/i,
      /TRUNCATE\s+TABLE/i,
      /DELETE\s+FROM.*WHERE\s+1\s*=\s*1/i,
      /SELECT\s+\*\s+FROM/i,
    ],
    severity: 'HIGH',
  },
  {
    id: 'data-002',
    name: 'SQL Injection Pattern',
    description: 'Potential SQL injection attempt',
    category: 'data_access',
    patterns: [
      /'\s*OR\s+'1'\s*=\s*'1/i,
      /;\s*DROP/i,
      /UNION\s+SELECT/i,
      /--\s*$/,
    ],
    severity: 'CRITICAL',
  },

  // Network violations
  {
    id: 'net-001',
    name: 'External Network Request',
    description: 'Attempt to make external network request',
    category: 'network',
    patterns: [
      /fetch\s*\(\s*['"`]https?:\/\//i,
      /axios\.(get|post|put|delete)/i,
      /http\.request/i,
      /curl\s+/i,
      /wget\s+/i,
    ],
    severity: 'MEDIUM',
  },
  {
    id: 'net-002',
    name: 'Internal Network Scan',
    description: 'Potential internal network scanning',
    category: 'network',
    patterns: [
      /192\.168\./,
      /10\.\d+\.\d+\./,
      /172\.(1[6-9]|2[0-9]|3[01])\./,
      /localhost:\d+/,
      /127\.0\.0\.1/,
    ],
    severity: 'HIGH',
  },

  // Authorization violations
  {
    id: 'auth-001',
    name: 'Privilege Escalation',
    description: 'Attempt to escalate privileges',
    category: 'authorization',
    patterns: [/sudo\s+/i, /chmod\s+777/i, /chown\s+root/i, /setuid/i],
    severity: 'CRITICAL',
  },
  {
    id: 'auth-002',
    name: 'Authentication Bypass',
    description: 'Potential authentication bypass attempt',
    category: 'authorization',
    patterns: [
      /admin[_-]?bypass/i,
      /skip[_-]?auth/i,
      /no[_-]?auth/i,
      /auth[_-]?disabled/i,
    ],
    severity: 'CRITICAL',
  },
];

export function checkPolicyViolations(
  content: string
): Array<{ rule: PolicyRule; matches: string[] }> {
  const violations: Array<{ rule: PolicyRule; matches: string[] }> = [];

  for (const rule of policyRules) {
    const matches: string[] = [];
    for (const pattern of rule.patterns) {
      const match = content.match(pattern);
      if (match) {
        matches.push(match[0]);
      }
    }
    if (matches.length > 0) {
      violations.push({ rule, matches });
    }
  }

  return violations;
}
