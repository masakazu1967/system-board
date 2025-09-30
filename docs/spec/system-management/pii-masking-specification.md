# PII検出・マスキング仕様書

**担当**: セキュリティエンジニア
**作成日**: 2025-09-21
**Issue**: #34 (US-SM-001: システム新規登録)
**関連仕様**: System集約設計仕様書 (US-SM-001.md)
**アーキテクチャパターン**: オニオンアーキテクチャ + DDD + CQRS + イベントソーシング

## 1. PII保護フレームワーク概要

### 1.1 設計原則

**製造業データ保護要件**:

- **個人情報保護法準拠**: 日本の個人情報保護法完全対応
- **GDPR準拠**: EU一般データ保護規則対応（将来的な国際展開対応）
- **情報漏洩防止**: ログ、エラーメッセージ、監査証跡での PII 完全マスキング
- **データ最小化原則**: 必要最小限の個人データのみ処理・保存
- **データ品質保持**: マスキング後もデータ分析・デバッグに有用な形式維持

### 1.2 PII分類体系

```typescript
export enum PIIClassification {
  // レベル1: 直接識別子（完全マスキング必須）
  DIRECT_IDENTIFIER = 'DIRECT_IDENTIFIER',

  // レベル2: 間接識別子（部分マスキング）
  INDIRECT_IDENTIFIER = 'INDIRECT_IDENTIFIER',

  // レベル3: 機密属性（コンテキスト依存マスキング）
  SENSITIVE_ATTRIBUTE = 'SENSITIVE_ATTRIBUTE',

  // レベル4: 準識別子（統計的開示リスクあり）
  QUASI_IDENTIFIER = 'QUASI_IDENTIFIER'
}

export enum MaskingLevel {
  NONE = 'NONE',                    // マスキング不要
  PARTIAL = 'PARTIAL',              // 部分マスキング
  FULL = 'FULL',                    // 完全マスキング
  HASH = 'HASH',                    // ハッシュ化
  TOKENIZATION = 'TOKENIZATION'     // トークン化
}
```

## 2. PII検出アルゴリズム

### 2.1 パターンベース検出

```typescript
export interface PIIPattern {
  type: PIIType;
  classification: PIIClassification;
  pattern: RegExp;
  confidence: number;
  maskingLevel: MaskingLevel;
  description: string;
}

export const PII_DETECTION_PATTERNS: PIIPattern[] = [
  // 日本固有の識別子
  {
    type: PIIType.JAPANESE_MY_NUMBER,
    classification: PIIClassification.DIRECT_IDENTIFIER,
    pattern: /\b\d{4}-\d{4}-\d{4}\b/g,
    confidence: 0.95,
    maskingLevel: MaskingLevel.FULL,
    description: 'マイナンバー（12桁）'
  },
  {
    type: PIIType.JAPANESE_POSTAL_CODE,
    classification: PIIClassification.QUASI_IDENTIFIER,
    pattern: /\b\d{3}-\d{4}\b/g,
    confidence: 0.85,
    maskingLevel: MaskingLevel.PARTIAL,
    description: '日本の郵便番号'
  },

  // グローバル識別子
  {
    type: PIIType.EMAIL_ADDRESS,
    classification: PIIClassification.DIRECT_IDENTIFIER,
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    confidence: 0.9,
    maskingLevel: MaskingLevel.PARTIAL,
    description: 'メールアドレス'
  },
  {
    type: PIIType.PHONE_NUMBER,
    classification: PIIClassification.DIRECT_IDENTIFIER,
    pattern: /\b(?:\+81|0)\d{1,4}-\d{1,4}-\d{4}\b/g,
    confidence: 0.85,
    maskingLevel: MaskingLevel.PARTIAL,
    description: '電話番号'
  },
  {
    type: PIIType.IP_ADDRESS,
    classification: PIIClassification.QUASI_IDENTIFIER,
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    confidence: 0.9,
    maskingLevel: MaskingLevel.PARTIAL,
    description: 'IPアドレス'
  },

  // システム識別子
  {
    type: PIIType.USER_ID,
    classification: PIIClassification.INDIRECT_IDENTIFIER,
    pattern: /\b(?:user|uid|username)[:=]\s*([a-zA-Z0-9._-]+)\b/gi,
    confidence: 0.8,
    maskingLevel: MaskingLevel.PARTIAL,
    description: 'ユーザーID'
  },
  {
    type: PIIType.SESSION_ID,
    classification: PIIClassification.SENSITIVE_ATTRIBUTE,
    pattern: /\b(?:session|sessionid|sess)[:=]\s*([a-fA-F0-9]{16,})\b/gi,
    confidence: 0.9,
    maskingLevel: MaskingLevel.HASH,
    description: 'セッションID'
  },

  // 製造業固有
  {
    type: PIIType.EMPLOYEE_ID,
    classification: PIIClassification.DIRECT_IDENTIFIER,
    pattern: /\b(?:emp|employee|社員番号)[:=]\s*([A-Z0-9]{4,10})\b/gi,
    confidence: 0.85,
    maskingLevel: MaskingLevel.TOKENIZATION,
    description: '従業員ID'
  },
  {
    type: PIIType.FACILITY_CODE,
    classification: PIIClassification.QUASI_IDENTIFIER,
    pattern: /\b(?:facility|plant|工場)[:=]\s*([A-Z0-9]{2,8})\b/gi,
    confidence: 0.8,
    maskingLevel: MaskingLevel.PARTIAL,
    description: '施設コード'
  }
];
```

### 2.2 コンテキスト分析検出

```typescript
@Injectable()
export class ContextualPIIDetector {
  constructor(
    private readonly nlpService: NaturalLanguageProcessingService,
    private readonly knowledgeBase: PIIKnowledgeBase
  ) {}

  /**
   * コンテキストベースPII検出
   */
  async detectPIIInContext(
    content: string,
    context: DetectionContext
  ): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];

    // 1. 形態素解析によるエンティティ抽出
    const entities = await this.nlpService.extractNamedEntities(content);

    // 2. 周辺コンテキスト分析
    for (const entity of entities) {
      const contextAnalysis = await this.analyzeEntityContext(entity, content);

      if (contextAnalysis.isPIILikely) {
        results.push({
          type: contextAnalysis.piiType,
          classification: contextAnalysis.classification,
          startIndex: entity.startIndex,
          endIndex: entity.endIndex,
          originalValue: entity.text,
          confidence: contextAnalysis.confidence,
          maskingLevel: this.determineMaskingLevel(contextAnalysis),
          context: context
        });
      }
    }

    // 3. 機械学習による高精度検出
    const mlResults = await this.mlBasedDetection(content, context);
    results.push(...mlResults);

    return this.deduplicate(results);
  }

  private async analyzeEntityContext(
    entity: NamedEntity,
    fullContent: string
  ): Promise<ContextAnalysis> {
    const contextWindow = this.extractContextWindow(entity, fullContent, 50);

    // コンテキストキーワード分析
    const contextKeywords = await this.nlpService.extractKeywords(contextWindow);

    // PII指標キーワードとの類似度計算
    const piiIndicators = this.knowledgeBase.getPIIIndicators();
    const similarity = this.calculateSimilarity(contextKeywords, piiIndicators);

    return {
      isPIILikely: similarity > 0.7,
      piiType: this.inferPIIType(contextKeywords),
      classification: this.inferClassification(entity, contextKeywords),
      confidence: similarity,
      reasoningPath: this.generateReasoningPath(entity, contextKeywords, similarity)
    };
  }
}
```

## 3. マスキングアルゴリズム

### 3.1 マスキング戦略

```typescript
export abstract class MaskingStrategy {
  abstract mask(value: string, context: MaskingContext): string;
  abstract unmask(maskedValue: string, context: MaskingContext): string | null;
  abstract preserveFormat(): boolean;
}

/**
 * 部分マスキング戦略
 */
export class PartialMaskingStrategy extends MaskingStrategy {
  constructor(
    private readonly preserveLength: boolean = true,
    private readonly preservePrefix: number = 2,
    private readonly preserveSuffix: number = 2
  ) {
    super();
  }

  mask(value: string, context: MaskingContext): string {
    if (value.length <= this.preservePrefix + this.preserveSuffix) {
      return '*'.repeat(this.preserveLength ? value.length : 3);
    }

    const prefix = value.substring(0, this.preservePrefix);
    const suffix = value.substring(value.length - this.preserveSuffix);
    const maskedMiddle = '*'.repeat(value.length - this.preservePrefix - this.preserveSuffix);

    return `${prefix}${maskedMiddle}${suffix}`;
  }

  unmask(maskedValue: string, context: MaskingContext): string | null {
    // 部分マスキングは不可逆
    return null;
  }

  preserveFormat(): boolean {
    return true;
  }
}

/**
 * フォーマット保持マスキング戦略
 */
export class FormatPreservingMaskingStrategy extends MaskingStrategy {
  private readonly formatPatterns: Map<string, string> = new Map([
    ['email', '[MASKED_EMAIL]@[DOMAIN]'],
    ['phone', '[MASKED_PHONE]'],
    ['ip', '[MASKED_IP]'],
    ['url', 'https://[MASKED_DOMAIN]/[MASKED_PATH]']
  ]);

  mask(value: string, context: MaskingContext): string {
    const piiType = context.piiType;

    switch (piiType) {
      case PIIType.EMAIL_ADDRESS:
        return this.maskEmail(value);
      case PIIType.PHONE_NUMBER:
        return this.maskPhone(value);
      case PIIType.IP_ADDRESS:
        return this.maskIPAddress(value);
      case PIIType.URL:
        return this.maskURL(value);
      default:
        return '[MASKED]';
    }
  }

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.length > 2
      ? `${localPart[0]}${'*'.repeat(localPart.length - 2)}${localPart[localPart.length - 1]}`
      : '*'.repeat(localPart.length);

    // ドメインは組織識別に重要な場合があるため部分的に保持
    const domainParts = domain.split('.');
    const maskedDomain = domainParts.length > 1
      ? `${domainParts[0].charAt(0)}***.${domainParts[domainParts.length - 1]}`
      : '***.' + domainParts[0];

    return `${maskedLocal}@${maskedDomain}`;
  }

  private maskPhone(phone: string): string {
    // 日本の電話番号形式を想定
    const digitsOnly = phone.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      const countryCode = phone.startsWith('+81') ? '+81' : '';
      const areaCode = digitsOnly.substring(0, 2);
      const masked = '*'.repeat(digitsOnly.length - 4);
      const lastDigits = digitsOnly.substring(digitsOnly.length - 2);

      return `${countryCode}${areaCode}-${masked}-${lastDigits}`;
    }
    return '[MASKED_PHONE]';
  }

  private maskIPAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      // 最初のオクテットは保持（ネットワーク分析に有用）
      return `${parts[0]}.***.***.***`;
    }
    return '[MASKED_IP]';
  }

  unmask(maskedValue: string, context: MaskingContext): string | null {
    return null; // フォーマット保持マスキングは不可逆
  }

  preserveFormat(): boolean {
    return true;
  }
}

/**
 * ハッシュベースマスキング戦略（可逆性あり）
 */
export class HashBasedMaskingStrategy extends MaskingStrategy {
  constructor(
    private readonly cryptoService: CryptographicService,
    private readonly saltPrefix: string = 'PII_MASK_'
  ) {
    super();
  }

  mask(value: string, context: MaskingContext): string {
    const salt = `${this.saltPrefix}${context.sessionId}`;
    const hash = this.cryptoService.hmacSHA256(value, salt);

    // 短縮ハッシュ（セキュリティとユーザビリティのバランス）
    const shortHash = hash.substring(0, 16);

    return `[HASH:${shortHash}]`;
  }

  unmask(maskedValue: string, context: MaskingContext): string | null {
    // ハッシュベースは通常不可逆だが、レインボーテーブルまたは
    // 安全な復号化機能が実装されている場合のみ可能
    if (context.hasDecryptionPermission) {
      return this.cryptoService.reverseHash(maskedValue, context);
    }
    return null;
  }

  preserveFormat(): boolean {
    return false;
  }
}
```

### 3.2 トークン化戦略

```typescript
/**
 * トークン化戦略（完全可逆、高セキュリティ）
 */
export class TokenizationStrategy extends MaskingStrategy {
  constructor(
    private readonly tokenVault: TokenVaultService,
    private readonly encryptionService: EncryptionService
  ) {
    super();
  }

  async mask(value: string, context: MaskingContext): Promise<string> {
    // 1. 既存トークンチェック
    const existingToken = await this.tokenVault.findTokenByValue(value);
    if (existingToken) {
      return this.formatToken(existingToken.token, context.piiType);
    }

    // 2. 新規トークン生成
    const token = await this.generateSecureToken();

    // 3. 暗号化して保存
    const encryptedValue = await this.encryptionService.encrypt(
      value,
      context.encryptionKey
    );

    await this.tokenVault.storeMapping({
      token,
      encryptedValue,
      piiType: context.piiType,
      classification: context.classification,
      createdAt: new Date(),
      expiresAt: this.calculateExpiration(context),
      accessCount: 0,
      lastAccessed: null
    });

    return this.formatToken(token, context.piiType);
  }

  async unmask(maskedValue: string, context: MaskingContext): Promise<string | null> {
    if (!context.hasUnmaskingPermission) {
      throw new UnauthorizedUnmaskingError('トークン解除権限がありません');
    }

    const token = this.extractTokenFromMasked(maskedValue);
    const mapping = await this.tokenVault.findMappingByToken(token);

    if (!mapping) {
      return null;
    }

    // アクセス監査
    await this.auditTokenAccess(token, context);

    // 復号化
    const decryptedValue = await this.encryptionService.decrypt(
      mapping.encryptedValue,
      context.encryptionKey
    );

    // アクセス統計更新
    await this.tokenVault.updateAccessStats(token);

    return decryptedValue;
  }

  private formatToken(token: string, piiType: PIIType): string {
    const prefix = this.getTokenPrefix(piiType);
    return `[${prefix}:${token}]`;
  }

  private getTokenPrefix(piiType: PIIType): string {
    const prefixes: Record<PIIType, string> = {
      [PIIType.EMAIL_ADDRESS]: 'EMAIL_TOKEN',
      [PIIType.EMPLOYEE_ID]: 'EMP_TOKEN',
      [PIIType.USER_ID]: 'USER_TOKEN',
      [PIIType.SESSION_ID]: 'SESS_TOKEN',
      [PIIType.PHONE_NUMBER]: 'PHONE_TOKEN'
    };

    return prefixes[piiType] || 'PII_TOKEN';
  }

  preserveFormat(): boolean {
    return false;
  }
}
```

## 4. PII処理サービス統合

### 4.1 統合PIIサービス

```typescript
@Injectable()
export class PIIMaskingService {
  private readonly detectors: Map<string, PIIDetector> = new Map();
  private readonly strategies: Map<MaskingLevel, MaskingStrategy> = new Map();

  constructor(
    private readonly patternDetector: PatternBasedPIIDetector,
    private readonly contextDetector: ContextualPIIDetector,
    private readonly configService: PIIConfigurationService,
    private readonly auditLogger: PIIAuditLogger
  ) {
    this.initializeDetectors();
    this.initializeStrategies();
  }

  /**
   * 文字列内のPII検出とマスキング
   */
  async maskPIIInString(
    content: string,
    context: ProcessingContext
  ): Promise<PIIMaskingResult> {
    const startTime = Date.now();

    try {
      // 1. PII検出
      const detectionResults = await this.detectPII(content, context);

      // 2. マスキング戦略選択
      const maskingPlan = await this.createMaskingPlan(detectionResults, context);

      // 3. マスキング実行
      const maskedContent = await this.applyMasking(content, maskingPlan);

      // 4. 結果検証
      const verification = await this.verifyMasking(maskedContent, detectionResults);

      const result: PIIMaskingResult = {
        originalContent: content,
        maskedContent: maskedContent.content,
        detectedPII: detectionResults,
        appliedMasks: maskedContent.appliedMasks,
        verification,
        processingTime: Date.now() - startTime,
        success: verification.isValid
      };

      // 5. 監査ログ
      await this.auditLogger.logPIIMasking({
        result,
        context,
        timestamp: new Date()
      });

      return result;

    } catch (error) {
      await this.auditLogger.logPIIMaskingError({
        error: error.message,
        content: content.substring(0, 100) + '...', // 最初の100文字のみ
        context,
        timestamp: new Date()
      });

      throw new PIIMaskingError(`PII masking failed: ${error.message}`);
    }
  }

  /**
   * オブジェクト内の全フィールドのPII処理
   */
  async maskPIIInObject(
    obj: Record<string, any>,
    context: ProcessingContext
  ): Promise<Record<string, any>> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const maskingResult = await this.maskPIIInString(value, {
          ...context,
          fieldName: key
        });
        result[key] = maskingResult.maskedContent;
      } else if (typeof value === 'object' && value !== null) {
        result[key] = await this.maskPIIInObject(value, {
          ...context,
          parentField: key
        });
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private async detectPII(
    content: string,
    context: ProcessingContext
  ): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];

    // パターンベース検出
    const patternResults = await this.patternDetector.detect(content, context);
    results.push(...patternResults);

    // コンテキストベース検出（高精度だが処理重い）
    if (context.enableContextualDetection) {
      const contextResults = await this.contextDetector.detectPIIInContext(content, {
        fieldName: context.fieldName,
        dataType: context.dataType,
        securityClassification: context.securityClassification
      });
      results.push(...contextResults);
    }

    return this.consolidateResults(results);
  }

  private async createMaskingPlan(
    detectionResults: PIIDetectionResult[],
    context: ProcessingContext
  ): Promise<MaskingPlan> {
    const plan: MaskingOperation[] = [];

    for (const detection of detectionResults) {
      const strategy = this.selectMaskingStrategy(detection, context);

      plan.push({
        detection,
        strategy,
        priority: this.calculateMaskingPriority(detection),
        preserveFormat: strategy.preserveFormat()
      });
    }

    // 優先度順でソート（高優先度から処理）
    plan.sort((a, b) => b.priority - a.priority);

    return { operations: plan };
  }
}
```

## 5. 実装チェックリスト

### 5.1 必須実装項目

- [ ] PIIDetectionService実装
- [ ] MaskingStrategyファクトリー実装
- [ ] TokenVaultService実装
- [ ] PIIAuditLogger実装
- [ ] 設定管理サービス実装
- [ ] パフォーマンス最適化

### 5.2 テスト要件

- [ ] 各PII検出パターンの精度テスト
- [ ] マスキング戦略の可逆性テスト
- [ ] パフォーマンステスト（大量データ処理）
- [ ] エラーハンドリングテスト
- [ ] セキュリティテスト（マスキング回避の検証）

### 5.3 コンプライアンス要件

- [ ] 個人情報保護法適合性確認
- [ ] GDPR要件マッピング
- [ ] データ保持ポリシー実装
- [ ] 削除権（忘れられる権利）対応
