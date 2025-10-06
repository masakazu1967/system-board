import { CriticalityLevel } from '../value-objects/CriticalityLevel';
import { VulnerabilityInfo } from '../value-objects/Package';

/**
 * SystemRegisteredData Interface
 * SystemRegisteredイベントのgetData()メソッドの戻り値型定義
 */
export interface SystemRegisteredData {
  systemId: string;
  name: string;
  type: string;
  host: {
    cpu: number;
    memory: number;
    storage: number;
    encryptionEnabled: boolean;
  };
  criticality: CriticalityLevel;
  packages: Array<{
    name: string;
    version: string;
    dependencies: string[];
    vulnerabilities: VulnerabilityInfo[];
  }>;
  securityClassification: string;
}
