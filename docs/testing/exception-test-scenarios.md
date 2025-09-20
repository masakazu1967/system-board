# System Board 例外処理・エラーケース テストシナリオ

**Phase**: Phase 2フォローアップ - 品質保証活動準備  
**作成日**: 2025年9月16日  
**主担当**: Test Engineer (QA Specialist)  
**対象**: Phase 2で特定されたCommands & Actorsの例外処理・エラーケーステスト

---

## 1. テスト戦略概要

### 1.1 テスト目標

System Boardプロジェクトの例外処理・エラーハンドリングの包括的なテスト戦略により以下を達成します：

- **堅牢性確保**: システム障害時でも業務継続性を保つエラーハンドリングの検証
- **セキュリティ検証**: 認証・認可エラーの適切な処理と監査ログ記録の確認
- **外部API対応**: GitHub API, NVD API, EndOfLife APIの障害シミュレーションとフォールバック検証
- **製造業コンプライアンス**: 5年間監査ログ保持とセキュリティ要件への適合確認
- **品質保証**: 80%以上のテストカバレッジとOWASP Top 10セキュリティテスト実施

### 1.2 テスト対象コマンド

Phase 2で特定された以下のコマンド群を対象とします：

**User Commands (24個)**:

- システム管理系: RegisterSystem, UpdateSystemConfiguration, ScaleHostResources等
- セキュリティ系: ApplySecurityPatch, ApproveMigrationPlan, ApproveRiskAcceptance等
- 監視・報告系: ViewDashboard, GenerateComplianceReport, ViewAuditLog等

**System Commands (12個)**:

- 定期実行系: ScanVulnerabilities, UpdateCVEDatabase, CheckSystemHealth等
- イベント駆動系: ProcessVulnerabilityDetection, CreateUrgentTask, TriggerSecurityAlert等

**External Commands (6個)**:

- Webhook系: ProcessRepositoryUpdate, HandleDependencyChange等
- フォールバック系: ActivateFallbackMode, NotifyAPIFailure等

### 1.3 技術スタック考慮事項

- **NestJS + TypeScript**: フレームワーク固有のテスト手法とモック戦略
- **CQRS + Event Sourcing**: イベント整合性とコマンド実行時の例外処理テスト
- **Onion Architecture**: ドメイン例外とインフラ例外の分離テスト
- **OAuth2.0 + JWT**: 認証・認可関連エラーの包括的テスト

---

## 2. Exception Hierarchy テストケース

### 2.1 基底例外クラステスト

```typescript
// SystemBoardException Base Class Tests
describe('SystemBoardException', () => {
  describe('Exception Hierarchy Validation', () => {
    it('should correctly classify domain exceptions', () => {
      const exception = new SystemManagementException('Test error');
      
      expect(exception).toBeInstanceOf(SystemBoardException);
      expect(exception).toBeInstanceOf(DomainException);
      expect(exception.context).toBe(ErrorContext.DOMAIN);
      expect(exception.code).toBe('SYS_MGMT_ERROR');
      expect(exception.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should generate correlation ID for tracing', () => {
      const exception = new VulnerabilityManagementException('CVE detection failed');
      
      expect(exception.correlationId).toBeDefined();
      expect(exception.correlationId).toMatch(/^[a-f0-9-]{36}$/); // UUID format
      expect(exception.timestamp).toBeInstanceOf(Date);
    });

    it('should preserve error cause chain', () => {
      const rootCause = new Error('Database connection failed');
      const exception = new DatabaseException('Transaction failed', rootCause);
      
      expect(exception.cause).toBe(rootCause);
      expect(exception.message).toContain('Transaction failed');
      expect(exception.severity).toBe(ErrorSeverity.HIGH);
    });
  });

  describe('Audit Log Generation', () => {
    it('should generate complete audit log entry', () => {
      const exception = new SecurityPatchApplicationException(
        'SYS-001',
        'PATCH-2024-001',
        'Dependencies not available'
      );
      
      const auditEntry = exception.toAuditLog();
      
      expect(auditEntry).toMatchObject({
        timestamp: expect.any(Date),
        correlationId: expect.stringMatching(/^[a-f0-9-]{36}$/),
        errorCode: 'VULN_MGMT_ERROR',
        severity: ErrorSeverity.HIGH,
        context: ErrorContext.DOMAIN,
        message: expect.stringContaining('Security patch application failed'),
        metadata: {
          systemId: 'SYS-001',
          patchId: 'PATCH-2024-001',
          action: 'SECURITY_PATCH_APPLICATION'
        }
      });
    });
  });
});
```

### 2.2 特化例外クラステスト

```typescript
describe('Domain-Specific Exceptions', () => {
  describe('SystemRegistrationException', () => {
    it('should handle duplicate system registration', async () => {
      const handler = new RegisterSystemHandler(
        mockSystemRepository,
        mockAuditLogger,
        mockEventBus
      );

      // Existing system mock
      mockSystemRepository.findById.mockResolvedValue(mockSystem);

      const command = new RegisterSystemCommand({
        id: 'EXISTING-001',
        name: 'Test System',
        hostId: 'HOST-001'
      });

      await expect(handler.execute(command))
        .rejects.toThrow(SystemRegistrationException);

      // Verify audit logging
      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'SYS_MGMT_ERROR',
          action: 'SYSTEM_REGISTRATION',
          metadata: expect.objectContaining({
            systemId: 'EXISTING-001'
          })
        })
      );
    });

    it('should validate required system fields', async () => {
      const command = new RegisterSystemCommand({
        id: 'SYS-001',
        name: '', // Invalid: empty name
        hostId: 'HOST-001'
      });

      await expect(handler.execute(command))
        .rejects.toThrow(CommandValidationException);

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'CMD_VALIDATION_ERROR',
          metadata: expect.objectContaining({
            field: 'name',
            value: ''
          })
        })
      );
    });
  });

  describe('VulnerabilityDetectionException', () => {
    it('should handle CVE processing failure', () => {
      const exception = new VulnerabilityDetectionException(
        'PKG-001',
        'CVE-2024-1234'
      );

      expect(exception.message).toContain('Vulnerability detection failed for package PKG-001');
      expect(exception.metadata).toMatchObject({
        packageId: 'PKG-001',
        cveId: 'CVE-2024-1234'
      });

      const auditEntry = exception.toAuditLog();
      expect(auditEntry.metadata.action).toBe('VULNERABILITY_DETECTION');
    });
  });
});
```

---

## 3. Command Handler エラー処理テスト

### 3.1 RegisterSystemCommand エラーシナリオ

```typescript
describe('RegisterSystemHandler Error Handling', () => {
  let handler: RegisterSystemHandler;
  let mockSystemRepository: jest.Mocked<SystemRepository>;
  let mockAuditLogger: jest.Mocked<AuditLogger>;
  let mockEventBus: jest.Mocked<EventBus>;

  beforeEach(() => {
    mockSystemRepository = createMockSystemRepository();
    mockAuditLogger = createMockAuditLogger();
    mockEventBus = createMockEventBus();
    
    handler = new RegisterSystemHandler(
      mockSystemRepository,
      mockAuditLogger,
      mockEventBus
    );
  });

  describe('Validation Errors', () => {
    it('should handle invalid system data structure', async () => {
      const invalidCommand = new RegisterSystemCommand({
        id: '', // Invalid: empty ID
        name: 'Test System',
        hostId: 'HOST-001'
      });

      await expect(handler.execute(invalidCommand))
        .rejects.toThrow(CommandValidationException);

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'CMD_VALIDATION_ERROR',
          severity: ErrorSeverity.LOW
        })
      );
    });

    it('should handle host validation failure', async () => {
      const command = new RegisterSystemCommand({
        id: 'SYS-001',
        name: 'Test System',
        hostId: 'INVALID-HOST'
      });

      mockSystemRepository.validateHost.mockRejectedValue(
        new Error('Host not found')
      );

      await expect(handler.execute(command))
        .rejects.toThrow(SystemRegistrationException);
    });
  });

  describe('Database Errors', () => {
    it('should handle database transaction failure', async () => {
      const command = createValidRegisterCommand();
      
      mockSystemRepository.save.mockRejectedValue(
        new DatabaseError('Transaction deadlock detected')
      );

      await expect(handler.execute(command))
        .rejects.toThrow(DatabaseException);

      // Verify compensation was attempted
      expect(mockSystemRepository.delete).not.toHaveBeenCalled(); // No partial state to clean
    });

    it('should perform compensation on partial failure', async () => {
      const command = createValidRegisterCommand();
      
      // System saved successfully but event publishing failed
      mockSystemRepository.save.mockResolvedValue(undefined);
      mockEventBus.publish.mockRejectedValue(
        new KurrentException('Event store unavailable')
      );

      await expect(handler.execute(command))
        .rejects.toThrow(KurrentException);

      // Verify compensation: system deletion attempted
      expect(mockSystemRepository.delete).toHaveBeenCalledWith(
        new SystemId(command.systemData.id)
      );
    });
  });

  describe('External Service Errors', () => {
    it('should handle dependency validation service failure', async () => {
      const command = createValidRegisterCommand();
      
      mockDependencyService.validateSystemDependencies.mockRejectedValue(
        new ExternalApiException('Dependency service timeout', 'DependencyAPI', 504)
      );

      // Should continue registration with warning
      await expect(handler.execute(command)).resolves.not.toThrow();

      expect(mockAuditLogger.logWarning).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Dependency validation failed')
        })
      );
    });
  });

  describe('Concurrent Access Errors', () => {
    it('should handle optimistic locking conflicts', async () => {
      const command = createValidRegisterCommand();
      
      mockSystemRepository.save.mockRejectedValue(
        new OptimisticLockingException('Version conflict detected')
      );

      await expect(handler.execute(command))
        .rejects.toThrow(OptimisticLockingException);

      // Should suggest retry to user
      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            retryable: true
          })
        })
      );
    });
  });
});
```

### 3.2 ApplySecurityPatchCommand エラーシナリオ

```typescript
describe('ApplySecurityPatchHandler Error Handling', () => {
  describe('Pre-execution Validation', () => {
    it('should validate system availability before patch', async () => {
      const command = new ApplySecurityPatchCommand({
        systemId: 'SYS-001',
        patchId: 'PATCH-2024-001',
        userId: 'USER-001'
      });

      mockSystemRepository.findById.mockResolvedValue(
        createMockSystem({ status: SystemStatus.MAINTENANCE })
      );

      await expect(handler.execute(command))
        .rejects.toThrow(SecurityPatchApplicationException);

      expect(error.message).toContain('System is not available for patching');
    });

    it('should validate patch compatibility', async () => {
      const command = createValidPatchCommand();
      
      mockPatchService.validateCompatibility.mockResolvedValue({
        compatible: false,
        conflicts: ['PKG-001', 'PKG-002']
      });

      await expect(handler.execute(command))
        .rejects.toThrow(SecurityPatchApplicationException);

      const auditLog = mockAuditLogger.logError.mock.calls[0][0];
      expect(auditLog.metadata.conflicts).toEqual(['PKG-001', 'PKG-002']);
    });
  });

  describe('Execution Errors', () => {
    it('should handle patch download failure', async () => {
      const command = createValidPatchCommand();
      
      mockPatchService.downloadPatch.mockRejectedValue(
        new ExternalApiException('Patch repository unavailable', 'PatchRepo', 503)
      );

      await expect(handler.execute(command))
        .rejects.toThrow(ExternalApiException);

      // Verify fallback: manual patch notification
      expect(mockNotificationService.sendManualPatchAlert).toHaveBeenCalledWith({
        systemId: command.systemId,
        patchId: command.patchId,
        reason: 'Automatic download failed'
      });
    });

    it('should handle patch application rollback', async () => {
      const command = createValidPatchCommand();
      
      // Patch application fails midway
      mockPatchService.applyPatch.mockRejectedValue(
        new SecurityPatchApplicationException(
          command.systemId,
          command.patchId,
          'Application failed at step 3/5'
        )
      );

      await expect(handler.execute(command))
        .rejects.toThrow(SecurityPatchApplicationException);

      // Verify rollback was initiated
      expect(mockPatchService.rollbackPatch).toHaveBeenCalledWith(
        command.systemId,
        command.patchId
      );

      // Verify system state reset
      expect(mockSystemRepository.updateStatus).toHaveBeenCalledWith(
        command.systemId,
        SystemStatus.ACTIVE
      );
    });
  });

  describe('Post-execution Validation', () => {
    it('should validate patch effectiveness', async () => {
      const command = createValidPatchCommand();
      
      // Patch applied but vulnerability still detected
      mockPatchService.applyPatch.mockResolvedValue(undefined);
      mockVulnerabilityScanner.rescanSystem.mockResolvedValue({
        vulnerabilities: [{ cveId: 'CVE-2024-1234', severity: 'HIGH' }]
      });

      await expect(handler.execute(command))
        .rejects.toThrow(SecurityPatchApplicationException);

      expect(error.message).toContain('Patch did not resolve vulnerability');
    });
  });
});
```

---

## 4. 外部API障害テストシナリオ

### 4.1 GitHub API 障害シミュレーション

```typescript
describe('GitHub API Integration Error Handling', () => {
  let apiClient: ExternalApiClient;
  let integrationService: IntegrationGatewayService;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;

  beforeEach(() => {
    apiClient = new ExternalApiClient();
    mockCircuitBreaker = createMockCircuitBreaker();
    integrationService = new IntegrationGatewayService(
      apiClient,
      mockEventBus,
      mockFallbackService
    );
  });

  describe('Rate Limiting Scenarios', () => {
    it('should handle GitHub API rate limit exceeded', async () => {
      const repositoryUrl = 'https://github.com/test/repo';
      
      mockGitHubApi.fetchRepository.mockRejectedValue(
        new GitHubApiException('/repos/test/repo', 403, 'API rate limit exceeded')
      );

      await expect(integrationService.synchronizeWithGitHub(repositoryUrl))
        .rejects.toThrow(GitHubApiException);

      // Verify circuit breaker recorded failure
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalled();

      // Verify fallback activation
      expect(mockFallbackService.activateGitHubFallback).toHaveBeenCalledWith(
        repositoryUrl,
        expect.any(GitHubApiException)
      );
    });

    it('should retry on transient GitHub API errors', async () => {
      const repositoryUrl = 'https://github.com/test/repo';
      
      // First two calls fail, third succeeds
      mockGitHubApi.fetchRepository
        .mockRejectedValueOnce(new GitHubApiException('/repos/test/repo', 502, 'Bad Gateway'))
        .mockRejectedValueOnce(new GitHubApiException('/repos/test/repo', 503, 'Service Unavailable'))
        .mockResolvedValueOnce(mockRepositoryData);

      await expect(integrationService.synchronizeWithGitHub(repositoryUrl))
        .resolves.not.toThrow();

      // Verify retry attempts
      expect(mockGitHubApi.fetchRepository).toHaveBeenCalledTimes(3);

      // Verify success was recorded
      expect(mockCircuitBreaker.recordSuccess).toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker Behavior', () => {
    it('should open circuit after failure threshold', async () => {
      mockCircuitBreaker.isOpen.mockReturnValue(true);

      const repositoryUrl = 'https://github.com/test/repo';

      await expect(integrationService.synchronizeWithGitHub(repositoryUrl))
        .rejects.toThrow(ExternalApiException);

      expect(error.message).toContain('Circuit breaker is OPEN');

      // Verify no actual API call was made
      expect(mockGitHubApi.fetchRepository).not.toHaveBeenCalled();
    });

    it('should transition to half-open and test recovery', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeoutMs: 60000,
        monitoringPeriodMs: 10000
      });

      // Trigger circuit opening
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }
      expect(circuitBreaker.isOpen()).toBe(true);

      // Simulate time passage
      jest.advanceTimersByTime(70000);
      circuitBreaker.checkState();

      // Should be half-open now
      expect(circuitBreaker.isOpen()).toBe(false);

      // Test recovery with successful call
      circuitBreaker.recordSuccess();
      expect(circuitBreaker.isOpen()).toBe(false);
    });
  });

  describe('Webhook Processing Errors', () => {
    it('should handle malformed GitHub webhook payload', async () => {
      const malformedPayload = {
        // Missing required fields
        repository: null,
        action: 'push'
      };

      await expect(
        integrationService.processGitHubWebhook(malformedPayload)
      ).rejects.toThrow(CommandValidationException);

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'CMD_VALIDATION_ERROR',
          metadata: expect.objectContaining({
            webhookSource: 'GitHub',
            validationFailure: 'Missing repository information'
          })
        })
      );
    });

    it('should validate GitHub webhook signature', async () => {
      const payload = createValidWebhookPayload();
      const invalidSignature = 'sha256=invalid_signature';

      await expect(
        integrationService.processGitHubWebhook(payload, invalidSignature)
      ).rejects.toThrow(SecurityException);

      expect(mockSecurityAuditLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'WEBHOOK_SIGNATURE_VALIDATION_FAILED',
          severity: ErrorSeverity.HIGH
        })
      );
    });
  });
});
```

### 4.2 NVD API 障害シミュレーション

```typescript
describe('NVD API Integration Error Handling', () => {
  describe('Data Synchronization Errors', () => {
    it('should handle NVD API service unavailable', async () => {
      mockNvdApi.fetchCVEUpdates.mockRejectedValue(
        new NvdApiException('unknown', 503, 'Service temporarily unavailable')
      );

      await expect(integrationService.fetchCVEUpdates())
        .resolves.not.toThrow(); // Should not throw due to fallback

      // Verify fallback to cached data
      expect(mockFallbackService.useCachedCVEData).toHaveBeenCalled();

      // Verify notification sent
      expect(mockNotificationService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EXTERNAL_API_CONNECTION_FAILED',
          api: 'NVD',
          fallbackActivated: true
        })
      );
    });

    it('should handle CVE data corruption', async () => {
      const corruptedData = {
        cve: {
          id: 'CVE-2024-1234',
          cvssScore: 'invalid_score', // Should be number
          description: null
        }
      };

      mockNvdApi.fetchCVEUpdates.mockResolvedValue([corruptedData]);

      await expect(integrationService.fetchCVEUpdates())
        .rejects.toThrow(NvdApiException);

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'EXTERNAL_API_ERROR',
          metadata: expect.objectContaining({
            apiName: 'NVD',
            dataValidationError: 'Invalid CVSS score format'
          })
        })
      );
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('should respect NVD API rate limits', async () => {
      // Simulate rate limit response
      mockNvdApi.fetchCVEUpdates.mockRejectedValue(
        new NvdApiException('unknown', 429, 'Rate limit exceeded')
      );

      const startTime = Date.now();
      
      await expect(integrationService.fetchCVEUpdates())
        .rejects.toThrow(NvdApiException);

      // Verify exponential backoff was applied
      const endTime = Date.now();
      expect(endTime - startTime).toBeGreaterThan(2000); // Base delay
    });

    it('should batch CVE requests efficiently', async () => {
      const largeCveList = Array.from({ length: 1000 }, (_, i) => 
        `CVE-2024-${i.toString().padStart(4, '0')}`
      );

      await integrationService.fetchSpecificCVEs(largeCveList);

      // Verify requests were batched (NVD allows max 2000 requests per 30 min)
      expect(mockNvdApi.fetchCVEData).toHaveBeenCalledTimes(1); // Single batch call
      expect(mockNvdApi.fetchCVEData).toHaveBeenCalledWith(
        expect.arrayContaining(largeCveList)
      );
    });
  });
});
```

---

## 5. セキュリティエラーテストシナリオ

### 5.1 認証エラーテスト

```typescript
describe('Authentication Error Handling', () => {
  let securityValidator: CommandSecurityValidator;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockAuditLogger: jest.Mocked<SecurityAuditLogger>;

  beforeEach(() => {
    mockAuthService = createMockAuthService();
    mockAuditLogger = createMockSecurityAuditLogger();
    securityValidator = new CommandSecurityValidator(
      mockAuthService,
      mockAuditLogger,
      mockPolicyEngine
    );
  });

  describe('JWT Token Validation', () => {
    it('should reject expired JWT tokens', async () => {
      const expiredContext = createSecurityContext({
        jwtToken: 'expired.jwt.token',
        userId: 'USER-001'
      });

      mockAuthService.validateToken.mockResolvedValue({
        isValid: false,
        reason: 'Token expired',
        expiresAt: new Date(Date.now() - 3600000) // 1 hour ago
      });

      const command = new RegisterSystemCommand(validSystemData);

      const result = await securityValidator.validateCommandExecution(
        command,
        expiredContext
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(AuthenticationException);

      // Verify audit logging
      expect(mockAuditLogger.logAuthenticationFailure).toHaveBeenCalledWith({
        userId: 'USER-001',
        ipAddress: expiredContext.ipAddress,
        reason: 'JWT token has expired',
        attemptNumber: 1,
        sessionId: expiredContext.sessionId
      });
    });

    it('should handle malformed JWT tokens', async () => {
      const malformedContext = createSecurityContext({
        jwtToken: 'malformed.token',
        userId: 'USER-001'
      });

      mockAuthService.validateToken.mockRejectedValue(
        new Error('Invalid token format')
      );

      const command = new ApplySecurityPatchCommand(validPatchData);

      await expect(
        securityValidator.validateCommandExecution(command, malformedContext)
      ).resolves.toMatchObject({
        isValid: false,
        error: expect.any(AuthenticationException)
      });
    });
  });

  describe('Session Management', () => {
    it('should invalidate expired sessions', async () => {
      const context = createValidSecurityContext();

      mockAuthService.validateToken.mockResolvedValue({
        isValid: true,
        expiresAt: new Date(Date.now() + 3600000)
      });

      mockAuthService.validateSession.mockResolvedValue(false);

      const command = new EscalateTaskCommand(validTaskData);

      const result = await securityValidator.validateCommandExecution(
        command,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.error.message).toContain('Invalid or expired session');
    });

    it('should enforce session timeout for high-risk operations', async () => {
      const context = createSecurityContext({
        userId: 'EXEC-001',
        sessionDuration: 7200000 // 2 hours - exceeds high-risk limit
      });

      const highRiskCommand = new ApproveRiskAcceptanceCommand({
        riskId: 'RISK-001',
        userId: 'EXEC-001',
        justification: 'Business continuity requirement'
      });

      mockAuthService.validateSession.mockResolvedValue(false);

      const result = await securityValidator.validateCommandExecution(
        highRiskCommand,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(AuthenticationException);
    });
  });

  describe('Multi-Factor Authentication', () => {
    it('should require MFA for high-risk commands', async () => {
      const context = createSecurityContext({
        userId: 'EXEC-001',
        mfaVerified: false
      });

      const highRiskCommand = new DecommissionSystemCommand({
        systemId: 'SYS-001',
        userId: 'EXEC-001',
        reason: 'End of life'
      });

      const result = await securityValidator.validateCommandExecution(
        highRiskCommand,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.error.message).toContain('MFA verification required');
    });

    it('should allow high-risk commands with valid MFA', async () => {
      const context = createSecurityContext({
        userId: 'EXEC-001',
        mfaVerified: true,
        mfaTimestamp: new Date(Date.now() - 300000) // 5 minutes ago
      });

      const highRiskCommand = new ApproveCapitalInvestmentCommand({
        investmentId: 'INV-001',
        amount: 100000,
        userId: 'EXEC-001'
      });

      mockAuthService.checkPermission.mockResolvedValue(true);
      mockPolicyEngine.checkPolicy.mockResolvedValue([]);

      const result = await securityValidator.validateCommandExecution(
        highRiskCommand,
        context
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('Brute Force Protection', () => {
    it('should detect authentication brute force patterns', async () => {
      const context = createSecurityContext({
        userId: 'USER-001',
        ipAddress: '192.168.1.100'
      });

      // Simulate multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await securityValidator.validateCommandExecution(
          new ViewDashboardCommand({ userId: 'USER-001' }),
          { ...context, attemptNumber: i + 1 }
        );
      }

      // Verify brute force detection
      expect(mockAuditLogger.logAuthenticationFailure).toHaveBeenCalledTimes(5);
      
      // Verify account lockout notification
      expect(mockNotificationService.sendSecurityAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BRUTE_FORCE_DETECTED',
          userId: 'USER-001',
          ipAddress: '192.168.1.100',
          severity: 'CRITICAL'
        })
      );
    });
  });
});
```

### 5.2 認可エラーテスト

```typescript
describe('Authorization Error Handling', () => {
  describe('Role-Based Access Control', () => {
    it('should deny system admin access to executive functions', async () => {
      const systemAdminContext = createSecurityContext({
        userId: 'ADMIN-001',
        userRoles: ['SYSTEM_ADMINISTRATOR']
      });

      const executiveCommand = new ApproveRiskAcceptanceCommand({
        riskId: 'RISK-001',
        userId: 'ADMIN-001'
      });

      mockAuthService.checkPermission.mockResolvedValue(false);

      const result = await securityValidator.validateCommandExecution(
        executiveCommand,
        systemAdminContext
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(AuthorizationException);

      // Verify authorization violation logging
      expect(mockAuditLogger.logAuthorizationViolation).toHaveBeenCalledWith({
        userId: 'ADMIN-001',
        resource: 'ApproveRiskAcceptanceCommand',
        permission: 'RISK_APPROVE',
        userRoles: ['SYSTEM_ADMINISTRATOR'],
        commandName: 'ApproveRiskAcceptanceCommand',
        sessionId: systemAdminContext.sessionId
      });
    });

    it('should allow security manager access to approval functions', async () => {
      const securityManagerContext = createSecurityContext({
        userId: 'SECMGR-001',
        userRoles: ['SECURITY_MANAGER']
      });

      const approvalCommand = new ApproveMigrationPlanCommand({
        planId: 'PLAN-001',
        userId: 'SECMGR-001'
      });

      mockAuthService.checkPermission.mockResolvedValue(true);
      mockPolicyEngine.checkPolicy.mockResolvedValue([]);

      const result = await securityValidator.validateCommandExecution(
        approvalCommand,
        securityManagerContext
      );

      expect(result.isValid).toBe(true);
    });
  });

  describe('Resource-Level Authorization', () => {
    it('should enforce system ownership for modifications', async () => {
      const context = createSecurityContext({
        userId: 'ADMIN-002',
        userRoles: ['SYSTEM_ADMINISTRATOR']
      });

      const command = new UpdateSystemConfigurationCommand({
        systemId: 'SYS-001', // Owned by different admin
        configuration: { setting: 'value' },
        userId: 'ADMIN-002'
      });

      mockAuthService.checkResourceAccess.mockResolvedValue(false);

      const result = await securityValidator.validateCommandExecution(
        command,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.error.message).toContain('insufficient permissions');
    });
  });

  describe('Security Policy Violations', () => {
    it('should enforce security policy constraints', async () => {
      const context = createValidSecurityContext();

      const command = new ApplySecurityPatchCommand({
        systemId: 'PROD-001', // Production system
        patchId: 'PATCH-BETA-001', // Beta patch - policy violation
        userId: context.userId
      });

      mockPolicyEngine.checkPolicy.mockResolvedValue([
        {
          policyName: 'PRODUCTION_PATCH_POLICY',
          type: 'BETA_PATCH_PROHIBITED',
          description: 'Beta patches not allowed on production systems',
          details: { systemType: 'PRODUCTION', patchType: 'BETA' }
        }
      ]);

      const result = await securityValidator.validateCommandExecution(
        command,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(SecurityPolicyViolationException);

      // Verify policy violation logging
      expect(mockAuditLogger.logSecurityPolicyViolation).toHaveBeenCalledWith({
        userId: context.userId,
        policyName: 'PRODUCTION_PATCH_POLICY',
        violationType: 'BETA_PATCH_PROHIBITED',
        action: 'ApplySecurityPatchCommand',
        policyDetails: expect.any(Object)
      });
    });

    it('should enforce rate limiting policies', async () => {
      const context = createValidSecurityContext();

      const command = new GenerateComplianceReportCommand({
        reportType: 'FULL_COMPLIANCE',
        userId: context.userId
      });

      mockAuthService.checkRateLimit.mockResolvedValue(true);

      const result = await securityValidator.validateCommandExecution(
        command,
        context
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeInstanceOf(SecurityPolicyViolationException);
      expect(result.error.metadata.policyName).toBe('RATE_LIMITING');
    });
  });
});
```

---

## 6. CQRS + Event Sourcing 整合性テスト

### 6.1 イベント整合性テスト

```typescript
describe('Event Sourcing Consistency Tests', () => {
  let eventStore: jest.Mocked<Kurrent>;
  let eventBus: jest.Mocked<EventBus>;
  let systemAggregate: SystemAggregate;

  beforeEach(() => {
    eventStore = createMockKurrent();
    eventBus = createMockEventBus();
    systemAggregate = new SystemAggregate();
  });

  describe('Event Publishing Failures', () => {
    it('should handle event store unavailability', async () => {
      const command = new RegisterSystemCommand(validSystemData);
      
      eventStore.appendToStream.mockRejectedValue(
        new KurrentException('Connection to Kurrent DB failed')
      );

      await expect(systemAggregate.handle(command))
        .rejects.toThrow(KurrentException);

      // Verify no side effects occurred
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(systemAggregate.getUncommittedEvents()).toHaveLength(0);
    });

    it('should handle partial event publishing failure', async () => {
      const command = new ApplySecurityPatchCommand(validPatchData);
      
      // Event store succeeds but event bus fails
      eventStore.appendToStream.mockResolvedValue(undefined);
      eventBus.publish.mockRejectedValue(
        new Error('Message broker unavailable')
      );

      await expect(systemAggregate.handle(command))
        .rejects.toThrow(CommandExecutionException);

      // Verify compensation: event store rollback
      expect(eventStore.rollbackStream).toHaveBeenCalled();
    });
  });

  describe('Event Replay Consistency', () => {
    it('should maintain aggregate state during replay', async () => {
      const events = [
        new SystemRegisteredEvent('SYS-001', systemData),
        new SecurityPatchAppliedEvent('SYS-001', 'PATCH-001'),
        new VulnerabilityDetectedEvent('SYS-001', vulnerabilityData)
      ];

      // Simulate event replay from store
      eventStore.readStreamEvents.mockResolvedValue(events);

      const aggregate = await SystemAggregate.fromHistory('SYS-001', eventStore);

      expect(aggregate.getId()).toBe('SYS-001');
      expect(aggregate.hasSecurityPatch('PATCH-001')).toBe(true);
      expect(aggregate.getActiveVulnerabilities()).toHaveLength(1);
    });

    it('should handle corrupted event data during replay', async () => {
      const corruptedEvents = [
        new SystemRegisteredEvent('SYS-001', systemData),
        null, // Corrupted event
        new SecurityPatchAppliedEvent('SYS-001', 'PATCH-001')
      ];

      eventStore.readStreamEvents.mockResolvedValue(corruptedEvents);

      await expect(
        SystemAggregate.fromHistory('SYS-001', eventStore)
      ).rejects.toThrow(KurrentException);

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'EVENT_STORE_ERROR',
          message: expect.stringContaining('Corrupted event detected')
        })
      );
    });
  });

  describe('Version Conflict Resolution', () => {
    it('should handle concurrent aggregate modifications', async () => {
      const aggregate1 = await SystemAggregate.fromHistory('SYS-001', eventStore);
      const aggregate2 = await SystemAggregate.fromHistory('SYS-001', eventStore);

      // Both aggregates modify the same system
      aggregate1.applySecurityPatch('PATCH-001');
      aggregate2.updateConfiguration(newConfig);

      // First aggregate commits successfully
      await aggregate1.commit(eventStore);

      // Second aggregate should detect version conflict
      await expect(aggregate2.commit(eventStore))
        .rejects.toThrow(OptimisticLockingException);

      expect(error.metadata.expectedVersion).toBeDefined();
      expect(error.metadata.actualVersion).toBeDefined();
    });
  });
});
```

### 6.2 Read Model 整合性テスト

```typescript
describe('Read Model Consistency Tests', () => {
  let readModelUpdater: ReadModelUpdater;
  let systemReadModel: jest.Mocked<SystemReadModel>;
  let vulnerabilityReadModel: jest.Mocked<VulnerabilityReadModel>;

  describe('Event Projection Failures', () => {
    it('should handle read model update failures', async () => {
      const event = new SystemRegisteredEvent('SYS-001', systemData);
      
      systemReadModel.upsert.mockRejectedValue(
        new DatabaseException('Read model database unavailable')
      );

      await expect(readModelUpdater.handle(event))
        .rejects.toThrow(DatabaseException);

      // Verify event is marked for replay
      expect(mockEventReplayQueue.add).toHaveBeenCalledWith({
        eventId: event.id,
        aggregateId: event.aggregateId,
        retryCount: 0
      });
    });

    it('should maintain read model consistency during bulk updates', async () => {
      const events = [
        new SystemRegisteredEvent('SYS-001', systemData),
        new VulnerabilityDetectedEvent('SYS-001', vulnData1),
        new VulnerabilityDetectedEvent('SYS-001', vulnData2),
        new SecurityPatchAppliedEvent('SYS-001', 'PATCH-001')
      ];

      // Simulate partial failure during bulk update
      systemReadModel.upsert
        .mockResolvedValueOnce(undefined) // System registration succeeds
        .mockRejectedValueOnce(new Error('Network timeout')); // First vulnerability fails

      await expect(
        readModelUpdater.handleBulkEvents(events)
      ).rejects.toThrow(DatabaseException);

      // Verify transaction rollback
      expect(systemReadModel.rollbackTransaction).toHaveBeenCalled();

      // Verify all events are queued for retry
      expect(mockEventReplayQueue.addBulk).toHaveBeenCalledWith(
        events.map(e => ({ eventId: e.id, aggregateId: e.aggregateId }))
      );
    });
  });

  describe('Data Integrity Validation', () => {
    it('should validate read model data consistency', async () => {
      const event = new SecurityPatchAppliedEvent('SYS-001', 'PATCH-001');
      
      // Mock inconsistent state: patch applied but vulnerability still exists
      systemReadModel.findById.mockResolvedValue({
        id: 'SYS-001',
        appliedPatches: ['PATCH-001'],
        activeVulnerabilities: ['CVE-2024-1234'] // Should be resolved by patch
      });

      await expect(readModelUpdater.handle(event))
        .rejects.toThrow(DataConsistencyException);

      expect(mockAuditLogger.logError).toHaveBeenCalledWith(
        expect.objectContaining({
          errorCode: 'DATA_CONSISTENCY_ERROR',
          metadata: expect.objectContaining({
            inconsistencyType: 'PATCH_VULNERABILITY_MISMATCH'
          })
        })
      );
    });
  });
});
```

---

## 7. パフォーマンステスト・負荷テスト

### 7.1 エラー処理パフォーマンステスト

```typescript
describe('Error Handling Performance Tests', () => {
  describe('Exception Creation Performance', () => {
    it('should create exceptions efficiently under load', async () => {
      const startTime = process.hrtime.bigint();
      
      // Create 1000 exceptions
      const exceptions = Array.from({ length: 1000 }, (_, i) => 
        new SystemRegistrationException(`SYS-${i}`, 'Performance test')
      );

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(durationMs).toBeLessThan(100); // Should complete within 100ms
      expect(exceptions).toHaveLength(1000);
      
      // Verify each exception has unique correlation ID
      const correlationIds = exceptions.map(e => e.correlationId);
      expect(new Set(correlationIds).size).toBe(1000);
    });

    it('should maintain memory efficiency during exception handling', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate many exceptions and let them be garbage collected
      for (let i = 0; i < 1000; i++) {
        try {
          throw new VulnerabilityDetectionException(`PKG-${i}`, `CVE-2024-${i}`);
        } catch (error) {
          // Simulate error handling
          const auditEntry = error.toAuditLog();
          expect(auditEntry).toBeDefined();
        }
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1_024 / 1_024;

      expect(memoryIncreaseMB).toBeLessThan(10); // Less than 10MB increase
    });
  });

  describe('Circuit Breaker Performance', () => {
    it('should fail fast when circuit is open', async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        recoveryTimeoutMs: 60000,
        monitoringPeriodMs: 10000
      });

      // Open the circuit
      for (let i = 0; i < 3; i++) {
        circuitBreaker.recordFailure();
      }

      const startTime = process.hrtime.bigint();
      
      // Test 100 rapid requests
      const promises = Array.from({ length: 100 }, () => 
        apiClient.executeWithRetry('github', async () => {
          throw new Error('Should not execute');
        })
      );

      await Promise.allSettled(promises);

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(durationMs).toBeLessThan(50); // Should fail immediately
    });
  });

  describe('Audit Logging Performance', () => {
    it('should handle high-volume audit logging efficiently', async () => {
      const auditLogger = new SecurityAuditLogger(
        mockAuditRepository,
        mockEncryptionService,
        mockNotificationService
      );

      const startTime = process.hrtime.bigint();
      
      // Log 1000 security events concurrently
      const promises = Array.from({ length: 1000 }, (_, i) => 
        auditLogger.logSecurityEvent({
          type: 'AUTHENTICATION_FAILURE',
          timestamp: new Date(),
          severity: ErrorSeverity.MEDIUM,
          userId: `USER-${i}`,
          ipAddress: `192.168.1.${i % 255}`,
          reason: 'Invalid credentials'
        })
      );

      await Promise.allSettled(promises);

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      expect(durationMs).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});
```

### 7.2 並行処理エラーテスト

```typescript
describe('Concurrent Error Handling Tests', () => {
  describe('Command Concurrency', () => {
    it('should handle concurrent system registrations safely', async () => {
      const systemId = 'SYS-CONCURRENT';
      
      // Attempt to register the same system concurrently
      const commands = Array.from({ length: 10 }, () => 
        new RegisterSystemCommand({
          id: systemId,
          name: 'Concurrent Test System',
          hostId: 'HOST-001'
        })
      );

      const results = await Promise.allSettled(
        commands.map(cmd => handler.execute(cmd))
      );

      // Only one should succeed, others should fail with duplicate error
      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(successful).toHaveLength(1);
      expect(failed).toHaveLength(9);

      // Verify all failures are SystemRegistrationException
      failed.forEach(result => {
        expect(result.reason).toBeInstanceOf(SystemRegistrationException);
        expect(result.reason.message).toContain('already exists');
      });
    });

    it('should handle concurrent patch applications with proper locking', async () => {
      const systemId = 'SYS-PATCH-CONCURRENT';
      
      const patchCommands = [
        new ApplySecurityPatchCommand({
          systemId,
          patchId: 'PATCH-001',
          userId: 'USER-001'
        }),
        new ApplySecurityPatchCommand({
          systemId,
          patchId: 'PATCH-002',
          userId: 'USER-002'
        })
      ];

      const results = await Promise.allSettled(
        patchCommands.map(cmd => patchHandler.execute(cmd))
      );

      // Both patches should be applied but in sequence due to locking
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);

      // Verify execution order was enforced
      expect(mockSystemLockService.acquireLock).toHaveBeenCalledTimes(2);
      expect(mockSystemLockService.releaseLock).toHaveBeenCalledTimes(2);
    });
  });

  describe('Resource Contention', () => {
    it('should handle database connection pool exhaustion', async () => {
      // Simulate connection pool exhaustion
      mockDatabasePool.getConnection.mockRejectedValue(
        new DatabaseException('Connection pool exhausted')
      );

      const commands = Array.from({ length: 20 }, (_, i) => 
        new RegisterSystemCommand({
          id: `SYS-${i}`,
          name: `System ${i}`,
          hostId: 'HOST-001'
        })
      );

      const results = await Promise.allSettled(
        commands.map(cmd => handler.execute(cmd))
      );

      // All should fail gracefully
      expect(results.every(r => r.status === 'rejected')).toBe(true);
      
      results.forEach(result => {
        expect(result.reason).toBeInstanceOf(DatabaseException);
      });

      // Verify circuit breaker activated
      expect(mockCircuitBreaker.recordFailure).toHaveBeenCalledTimes(20);
    });
  });
});
```

---

## 8. 自動化テスト戦略

### 8.1 テストデータ管理

```typescript
// Test Data Factory
export class TestDataFactory {
  static createValidSystemData(overrides?: Partial<SystemData>): SystemData {
    return {
      id: 'SYS-001',
      name: 'Test System',
      hostId: 'HOST-001',
      environment: 'DEVELOPMENT',
      criticality: 'MEDIUM',
      ...overrides
    };
  }

  static createSecurityContext(overrides?: Partial<SecurityContext>): SecurityContext {
    return {
      userId: 'USER-001',
      sessionId: generateSessionId(),
      jwtToken: generateMockJWT(),
      userRoles: ['SYSTEM_ADMINISTRATOR'],
      ipAddress: '192.168.1.100',
      userAgent: 'Test Agent/1.0',
      mfaVerified: false,
      ...overrides
    };
  }

  static createVulnerabilityData(overrides?: Partial<VulnerabilityData>): VulnerabilityData {
    return {
      cveId: 'CVE-2024-1234',
      cvssScore: 7.5,
      severity: 'HIGH',
      packageId: 'PKG-001',
      description: 'Test vulnerability',
      publishedDate: new Date(),
      ...overrides
    };
  }

  static createMockException<T extends SystemBoardException>(
    ExceptionClass: new (...args: any[]) => T,
    message: string,
    metadata?: Record<string, unknown>
  ): T {
    const exception = new ExceptionClass(message);
    if (metadata) {
      Object.assign(exception.metadata, metadata);
    }
    return exception;
  }
}

// Error Simulation Utilities
export class ErrorSimulator {
  static simulateNetworkTimeout(delayMs: number = 5000): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new ExternalApiException('Network timeout', 'TestAPI', 504));
      }, delayMs);
    });
  }

  static simulateRateLimitExceeded(api: string): ExternalApiException {
    return new ExternalApiException(
      `Rate limit exceeded for ${api}`,
      api,
      429
    );
  }

  static simulateDatabaseConnectionFailure(): DatabaseException {
    return new DatabaseException(
      'Connection to database failed',
      new Error('ECONNREFUSED')
    );
  }

  static simulateAuthenticationFailure(reason: string): AuthenticationException {
    return new AuthenticationException(reason);
  }

  static simulateMemoryPressure(): Error {
    return new Error('JavaScript heap out of memory');
  }
}
```

### 8.2 テスト自動化設定

```yaml
# GitHub Actions Workflow for Exception Testing
name: Exception Handling Tests

on:
  pull_request:
    paths:
      - 'apps/backend/**'
      - 'packages/**'
  push:
    branches: [main]

jobs:
  exception-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      eventstore:
        image: eventstore/eventstore:22.10.0-buster-slim
        env:
          EVENTSTORE_CLUSTER_SIZE: 1
          EVENTSTORE_RUN_PROJECTIONS: All
          EVENTSTORE_START_STANDARD_PROJECTIONS: true
          EVENTSTORE_HTTP_PORT: 2113
          EVENTSTORE_INSECURE: true
        ports:
          - 2113:2113

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Setup test databases
        run: |
          pnpm run db:test:setup
          pnpm run eventstore:test:setup
      
      - name: Run exception handling tests
        run: |
          pnpm run test:exception-handling
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://postgres:test@localhost:5432/system_board_test
          EVENTSTORE_URL: esdb://localhost:2113?tls=false
      
      - name: Run security error tests
        run: |
          pnpm run test:security-errors
        env:
          AUTH0_DOMAIN: test.auth0.com
          AUTH0_CLIENT_ID: test_client_id
      
      - name: Run API failure simulation tests
        run: |
          pnpm run test:api-failures
        env:
          GITHUB_TOKEN: mock_token
          NVD_API_KEY: mock_key
      
      - name: Generate test coverage report
        run: |
          pnpm run test:coverage:exception-handling
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/exception-handling/lcov.info
          flags: exception-handling
          name: exception-handling-coverage
```

### 8.3 CI/CD統合テスト設定

```typescript
// Jest Configuration for Exception Testing
export default {
  displayName: 'Exception Handling Tests',
  testMatch: [
    '<rootDir>/test/exception-handling/**/*.test.ts',
    '<rootDir>/test/security-errors/**/*.test.ts',
    '<rootDir>/test/api-failures/**/*.test.ts'
  ],
  
  setupFilesAfterEnv: [
    '<rootDir>/test/setup/exception-test-setup.ts'
  ],
  
  testEnvironment: 'node',
  
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/test/**',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts'
  ],
  
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Exception handling specific thresholds
    './src/domain/exceptions/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/application/handlers/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Test timeout for long-running error scenarios
  testTimeout: 30000,
  
  // Enable verbose output for exception tests
  verbose: true,
  
  // Mock external services by default
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.test.json'
    }
  }
};
```

---

## 9. テストケースマトリックス

### 9.1 Command × Error Pattern Matrix

| Command Category | Authentication Error | Authorization Error | Validation Error | Infrastructure Error | External API Error | Business Logic Error |
|------------------|---------------------|-------------------|------------------|---------------------|-------------------|-------------------|
| **System Management** | | | | | | |
| RegisterSystem | ✅ JWT Expired | ✅ Insufficient Role | ✅ Duplicate ID | ✅ DB Connection | ❌ N/A | ✅ Host Not Found |
| UpdateSystemConfiguration | ✅ Session Invalid | ✅ System Ownership | ✅ Invalid Config | ✅ Transaction Fail | ❌ N/A | ✅ System Locked |
| ScaleHostResources | ✅ MFA Required | ✅ Resource Limits | ✅ Invalid Scale | ✅ Resource Pool | ❌ N/A | ✅ Budget Exceeded |
| DecommissionSystem | ✅ MFA Required | ✅ Executive Only | ✅ Has Dependencies | ✅ DB Lock | ❌ N/A | ✅ Active Tasks |
| **Security Commands** | | | | | | |
| ApplySecurityPatch | ✅ Token Refresh | ✅ Patch Permission | ✅ Incompatible | ✅ Kurrent Fail | ✅ Patch Download | ✅ System Busy |
| ApproveMigrationPlan | ✅ Session Timeout | ✅ Manager Role | ✅ Plan Invalid | ✅ Audit Log Fail | ❌ N/A | ✅ No Migration |
| ApproveRiskAcceptance | ✅ MFA Required | ✅ Executive Only | ✅ Missing Justification | ✅ Audit Storage | ❌ N/A | ✅ Risk Resolved |
| **Task Management** | | | | | | |
| StartVulnerabilityTask | ✅ Basic Auth | ✅ Task Permission | ✅ No Vulnerability | ✅ Queue Full | ❌ N/A | ✅ Task Exists |
| CompleteTask | ✅ Basic Auth | ✅ Task Owner | ✅ Not In Progress | ✅ State Update | ❌ N/A | ✅ Dependencies |
| EscalateTask | ✅ Basic Auth | ✅ Manager Role | ✅ Cannot Escalate | ✅ Notification Fail | ✅ Teams API | ✅ Already Escalated |
| **Integration Commands** | | | | | | |
| SynchronizeWithGitHub | ✅ Service Auth | ✅ Integration Role | ✅ Invalid Repo | ✅ Circuit Breaker | ✅ Rate Limit | ✅ No Changes |
| FetchCVEUpdates | ✅ Service Auth | ✅ System Role | ✅ Invalid Date Range | ✅ Cache Failure | ✅ NVD Timeout | ✅ No Updates |
| ProcessRepositoryUpdate | ✅ Webhook Sig | ✅ Webhook Auth | ✅ Malformed Payload | ✅ Message Queue | ✅ GitHub API | ✅ No Repository |

### 9.2 Error Severity × Response Strategy Matrix

| Error Severity | Immediate Action | Notification | Retry Strategy | Fallback Action | Audit Level |
|----------------|------------------|--------------|----------------|-----------------|-------------|
| **LOW** | Log Error | None | 3 attempts, 1s delay | Continue with degraded functionality | Standard |
| **MEDIUM** | Log Error + Alert | Developer notification | 3 attempts, exponential backoff | Activate fallback service | Enhanced |
| **HIGH** | Stop Operation | Manager notification | 5 attempts, circuit breaker | Manual intervention required | Full |
| **CRITICAL** | Emergency Stop | Executive + Teams alert | No retry, immediate escalation | Emergency procedures | Complete |

### 9.3 Test Coverage Requirements

| Component | Unit Test Coverage | Integration Test Coverage | E2E Test Coverage | Security Test Coverage |
|-----------|-------------------|---------------------------|-------------------|----------------------|
| **Exception Classes** | 95% | N/A | N/A | 100% |
| **Command Handlers** | 85% | 90% | 70% | 95% |
| **Error Middleware** | 90% | 95% | 80% | 100% |
| **Circuit Breakers** | 85% | 95% | N/A | 85% |
| **Audit Loggers** | 90% | 85% | N/A | 100% |
| **Fallback Services** | 80% | 95% | 85% | 90% |

---

## 10. 実装ロードマップ

### 10.1 Phase 3 実装優先順位

**Week 1: 基盤例外処理実装**:

- SystemBoardException基底クラス群
- Domain/Application/Infrastructure例外階層
- 基本的なエラーハンドリングパターン

**Week 2: コマンドハンドラーエラー処理**:

- RegisterSystemHandler error handling
- ApplySecurityPatchHandler error handling  
- QueryHandler error handling patterns

**Week 3: 外部API例外処理**:

- ExternalApiClient with retry logic
- Circuit Breaker implementation
- GitHub/NVD/EndOfLife API error handling

**Week 4: セキュリティ例外処理**:

- SecurityAuditLogger implementation
- Authentication/Authorization error handling
- Security policy violation handling

### 10.2 テスト実装スケジュール

**Week 5-6: ユニットテスト実装**:

- Exception class tests
- Command handler error tests
- Service layer error tests

**Week 7-8: 統合テスト実装**:

- API integration error tests
- Database transaction error tests
- Event Sourcing consistency tests

**Week 9-10: システムテスト実装**:

- End-to-end error scenario tests
- Performance under error conditions
- Security penetration tests

### 10.3 品質ゲート定義

**Code Review Requirements:**

- All exception handling code requires Security Engineer review
- Performance impact assessment for error paths
- Audit logging compliance verification

**Automated Testing Gates:**

- 80%+ test coverage before merge
- All OWASP Top 10 security tests passing
- Performance regression tests under error conditions

**Manual Testing Requirements:**

- End-to-end error scenario validation
- Microsoft Teams notification testing
- Audit log retention verification

---

## 11. まとめ

### 11.1 テスト戦略の包括性

本テストシナリオは以下の包括的なエラーケースをカバーします：

- **42個のコマンド**に対する体系的なエラーテスト
- **6種類のエラーパターン**（認証・認可・検証・インフラ・外部API・ビジネスロジック）
- **4段階のエラー重要度**に応じた対応戦略
- **OWASP Top 10セキュリティ要件**への完全対応
- **5年間監査ログ保持**を含む製造業コンプライアンス

### 11.2 技術実装可能性

- **NestJS + TypeScript**: フレームワーク固有のテスト手法を活用
- **CQRS + Event Sourcing**: イベント整合性の包括的検証
- **Onion Architecture**: レイヤー分離による効果的なテスト戦略
- **CI/CD統合**: GitHub Actionsでの自動化テスト実行

### 11.3 Phase 3実装準備完了

本テストシナリオにより、Phase 3「ビジネスルール・ポリシー実装」での品質保証活動が準備完了しました：

- **実行可能なテストケース**: 具体的なコード例を含む実装可能なテスト
- **自動化戦略**: CI/CDパイプラインでの継続的テスト実行
- **品質メトリクス**: 明確なカバレッジ要件と品質ゲート
- **製造業対応**: セキュリティ要件とコンプライアンス検証

---

**ドキュメント作成日**: 2025年9月16日  
**主担当**: Test Engineer (QA Specialist)  
**次期アクション**: Phase 3実装開始時のテスト戦略適用  
**更新予定**: Phase 3実装完了後のテスト結果反映
